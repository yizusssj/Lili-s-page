-- Evita notificaciones de tareas que ya fueron enviadas a la papelera.

begin;

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
      and task.deleted_at is null
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
