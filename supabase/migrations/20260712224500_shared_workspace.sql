-- Convierte Lili's Page de datos separados por usuario a un workspace compartido.
-- Ejecuta esta migración una sola vez, después de 20260712221500_initial_workspace_schema.sql.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'workspace_id'
  ) then
    raise exception 'La migración de workspace compartido ya fue aplicada.';
  end if;

  if exists (select 1 from public.tasks)
    or exists (select 1 from public.notes)
    or exists (select 1 from public.today_priorities)
    or exists (select 1 from public.quick_notes) then
    raise exception 'Hay datos en las tablas actuales. Detén la migración y realiza una conversión con respaldo.';
  end if;
end;
$$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx
  on public.workspace_members (user_id, workspace_id);

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger set_workspace_members_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

-- Las tablas de contenido ahora pertenecen al workspace, no a una sola cuenta.
drop index if exists public.tasks_user_created_at_idx;
alter table public.tasks rename constraint tasks_user_id_fkey to tasks_created_by_fkey;
alter table public.tasks rename column user_id to created_by;
alter table public.tasks
  add column workspace_id uuid not null references public.workspaces (id) on delete cascade;
create index tasks_workspace_created_at_idx
  on public.tasks (workspace_id, created_at desc);

drop index if exists public.notes_user_pinned_updated_at_idx;
alter table public.notes rename constraint notes_user_id_fkey to notes_created_by_fkey;
alter table public.notes rename column user_id to created_by;
alter table public.notes
  add column workspace_id uuid not null references public.workspaces (id) on delete cascade;
create index notes_workspace_pinned_updated_at_idx
  on public.notes (workspace_id, pinned desc, updated_at desc);

drop index if exists public.priorities_user_position_idx;
alter table public.today_priorities
  drop constraint today_priorities_user_id_position_key;
alter table public.today_priorities
  rename constraint today_priorities_user_id_fkey to today_priorities_created_by_fkey;
alter table public.today_priorities rename column user_id to created_by;
alter table public.today_priorities
  add column workspace_id uuid not null references public.workspaces (id) on delete cascade;
alter table public.today_priorities
  add constraint today_priorities_workspace_position_key unique (workspace_id, position);
create index priorities_workspace_position_idx
  on public.today_priorities (workspace_id, position);

alter table public.quick_notes drop constraint quick_notes_pkey;
alter table public.quick_notes
  rename constraint quick_notes_user_id_fkey to quick_notes_created_by_fkey;
alter table public.quick_notes rename column user_id to created_by;
alter table public.quick_notes
  add column workspace_id uuid not null references public.workspaces (id) on delete cascade;
alter table public.quick_notes add primary key (workspace_id);

-- Estas funciones evitan políticas recursivas sobre workspace_members.
-- SECURITY DEFINER solo devuelve booleanos y nunca expone filas.
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.user_id = (select auth.uid())
      and member.role = 'owner'
  );
$$;

create or replace function public.is_workspace_creator(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces as workspace
    where workspace.id = target_workspace_id
      and workspace.created_by = (select auth.uid())
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.is_workspace_creator(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.is_workspace_creator(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

revoke all on table public.workspaces from anon;
revoke all on table public.workspace_members from anon;
grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;

create policy "Members select workspaces"
on public.workspaces for select
to authenticated
using (
  public.is_workspace_member(id)
  or created_by = (select auth.uid())
);

create policy "Users create workspaces"
on public.workspaces for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "Owners update workspaces"
on public.workspaces for update
to authenticated
using (
  public.is_workspace_owner(id)
  or created_by = (select auth.uid())
)
with check (
  public.is_workspace_owner(id)
  or created_by = (select auth.uid())
);

create policy "Owners delete workspaces"
on public.workspaces for delete
to authenticated
using (
  public.is_workspace_owner(id)
  or created_by = (select auth.uid())
);

create policy "Members select memberships"
on public.workspace_members for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  or public.is_workspace_creator(workspace_id)
);

create policy "Owners insert memberships"
on public.workspace_members for insert
to authenticated
with check (
  public.is_workspace_owner(workspace_id)
  or public.is_workspace_creator(workspace_id)
);

create policy "Owners update memberships"
on public.workspace_members for update
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or public.is_workspace_creator(workspace_id)
)
with check (
  public.is_workspace_owner(workspace_id)
  or public.is_workspace_creator(workspace_id)
);

create policy "Owners delete memberships"
on public.workspace_members for delete
to authenticated
using (
  public.is_workspace_owner(workspace_id)
  or public.is_workspace_creator(workspace_id)
);

-- Sustituye las políticas individuales de la primera migración.
drop policy if exists "Users select own tasks" on public.tasks;
drop policy if exists "Users insert own tasks" on public.tasks;
drop policy if exists "Users update own tasks" on public.tasks;
drop policy if exists "Users delete own tasks" on public.tasks;

create policy "Members select workspace tasks"
on public.tasks for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Members insert workspace tasks"
on public.tasks for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "Members update workspace tasks"
on public.tasks for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members delete workspace tasks"
on public.tasks for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Users select own notes" on public.notes;
drop policy if exists "Users insert own notes" on public.notes;
drop policy if exists "Users update own notes" on public.notes;
drop policy if exists "Users delete own notes" on public.notes;

create policy "Members select workspace notes"
on public.notes for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Members insert workspace notes"
on public.notes for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "Members update workspace notes"
on public.notes for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members delete workspace notes"
on public.notes for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Users select own priorities" on public.today_priorities;
drop policy if exists "Users insert own priorities" on public.today_priorities;
drop policy if exists "Users update own priorities" on public.today_priorities;
drop policy if exists "Users delete own priorities" on public.today_priorities;

create policy "Members select workspace priorities"
on public.today_priorities for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Members insert workspace priorities"
on public.today_priorities for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "Members update workspace priorities"
on public.today_priorities for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members delete workspace priorities"
on public.today_priorities for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Users select own quick note" on public.quick_notes;
drop policy if exists "Users insert own quick note" on public.quick_notes;
drop policy if exists "Users update own quick note" on public.quick_notes;
drop policy if exists "Users delete own quick note" on public.quick_notes;

create policy "Members select workspace quick note"
on public.quick_notes for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Members insert workspace quick note"
on public.quick_notes for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "Members update workspace quick note"
on public.quick_notes for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members delete workspace quick note"
on public.quick_notes for delete to authenticated
using (public.is_workspace_member(workspace_id));

commit;
