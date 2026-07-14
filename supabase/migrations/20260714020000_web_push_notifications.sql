-- Suscripciones Web Push privadas y cola deduplicada para recordatorios del celular.
-- Puede ejecutarse más de una vez sin eliminar datos existentes.

begin;

alter table public.workspaces
  add column if not exists timezone text not null default 'America/Hermosillo';

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 4000),
  p256dh text not null check (char_length(p256dh) between 20 and 500),
  auth text not null check (char_length(auth) between 8 and 500),
  user_agent text check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_workspace_user_idx
  on public.push_subscriptions (workspace_id, user_id);

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists "Users select own push subscriptions" on public.push_subscriptions;
create policy "Users select own push subscriptions"
on public.push_subscriptions for select to authenticated
using (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

drop policy if exists "Users insert own push subscriptions" on public.push_subscriptions;
create policy "Users insert own push subscriptions"
on public.push_subscriptions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

drop policy if exists "Users update own push subscriptions" on public.push_subscriptions;
create policy "Users update own push subscriptions"
on public.push_subscriptions for update to authenticated
using (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
)
with check (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

drop policy if exists "Users delete own push subscriptions" on public.push_subscriptions;
create policy "Users delete own push subscriptions"
on public.push_subscriptions for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.is_workspace_member(workspace_id)
);

create or replace function public.register_push_subscription(
  target_workspace_id uuid,
  target_endpoint text,
  target_p256dh text,
  target_auth text,
  target_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_id uuid;
begin
  if (select auth.uid()) is null
    or not public.is_workspace_member(target_workspace_id) then
    raise exception 'No tienes acceso a este workspace.';
  end if;

  insert into public.push_subscriptions as subscription (
    workspace_id,
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent
  ) values (
    target_workspace_id,
    (select auth.uid()),
    target_endpoint,
    target_p256dh,
    target_auth,
    nullif(btrim(left(coalesce(target_user_agent, ''), 500)), '')
  )
  on conflict (endpoint) do update set
    workspace_id = excluded.workspace_id,
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent
  returning subscription.id into subscription_id;

  return subscription_id;
end;
$$;

revoke all on function public.register_push_subscription(uuid, text, text, text, text) from public;
grant execute on function public.register_push_subscription(uuid, text, text, text, text) to authenticated;

create table if not exists public.push_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, subscription_id, scheduled_for)
);

create index if not exists push_reminder_deliveries_pending_idx
  on public.push_reminder_deliveries (created_at)
  where delivered_at is null;

alter table public.push_reminder_deliveries enable row level security;
revoke all on table public.push_reminder_deliveries from anon, authenticated;
grant select, insert, update, delete on table public.push_reminder_deliveries to service_role;

create or replace function public.claim_due_push_reminders(
  claimed_at timestamptz default now()
)
returns table (
  delivery_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  subscription_auth text,
  task_id uuid,
  task_text text,
  scheduled_for timestamptz
)
language sql
volatile
security definer
set search_path = ''
as $$
  with candidates as materialized (
    select
      task.id as task_id,
      subscription.id as subscription_id,
      schedule.scheduled_for
    from public.tasks as task
    join public.workspaces as workspace
      on workspace.id = task.workspace_id
    join public.push_subscriptions as subscription
      on subscription.workspace_id = task.workspace_id
    cross join lateral (
      select
        ((task.due_date + task.due_time) at time zone workspace.timezone)
        - make_interval(mins => task.reminder_minutes_before) as scheduled_for
    ) as schedule
    where task.done = false
      and task.due_date is not null
      and task.due_time is not null
      and task.reminder_minutes_before is not null
      and task.reminder_acknowledged_at is null
      and schedule.scheduled_for <= claimed_at
      and schedule.scheduled_for > claimed_at - interval '6 hours'
      and task.updated_at <= schedule.scheduled_for
  ),
  claimed as (
    insert into public.push_reminder_deliveries (
      task_id,
      subscription_id,
      scheduled_for
    )
    select
      candidate.task_id,
      candidate.subscription_id,
      candidate.scheduled_for
    from candidates as candidate
    on conflict (task_id, subscription_id, scheduled_for) do nothing
    returning
      public.push_reminder_deliveries.id,
      public.push_reminder_deliveries.task_id,
      public.push_reminder_deliveries.subscription_id,
      public.push_reminder_deliveries.scheduled_for
  )
  select
    claimed.id as delivery_id,
    subscription.id as subscription_id,
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth as subscription_auth,
    task.id as task_id,
    task.text as task_text,
    claimed.scheduled_for
  from claimed
  join public.push_subscriptions as subscription
    on subscription.id = claimed.subscription_id
  join public.tasks as task
    on task.id = claimed.task_id;
$$;

revoke all on function public.claim_due_push_reminders(timestamptz) from public;
grant execute on function public.claim_due_push_reminders(timestamptz) to service_role;

commit;
