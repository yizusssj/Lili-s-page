-- Esquema inicial de Lili's Page.
-- Se puede ejecutar más de una vez sin duplicar tablas, índices, triggers o políticas.

begin;

-- Tareas generales de la usuaria.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notas con contenido y estado fijado.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Nueva nota' check (char_length(title) <= 200),
  content text not null default '' check (char_length(content) <= 100000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Las tres prioridades conservan su texto entre días.
-- completed_on indica el día local en que se completó una prioridad;
-- si no coincide con el día actual, la interfaz la muestra como pendiente.
create table if not exists public.today_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  text text not null default '' check (char_length(text) <= 500),
  completed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, position)
);

-- Una nota rápida por usuaria.
create table if not exists public.quick_notes (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_created_at_idx
  on public.tasks (user_id, created_at desc);

create index if not exists notes_user_pinned_updated_at_idx
  on public.notes (user_id, pinned desc, updated_at desc);

create index if not exists priorities_user_position_idx
  on public.today_priorities (user_id, position);

-- Mantiene updated_at correcto sin depender del navegador.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists set_priorities_updated_at on public.today_priorities;
create trigger set_priorities_updated_at
before update on public.today_priorities
for each row execute function public.set_updated_at();

drop trigger if exists set_quick_notes_updated_at on public.quick_notes;
create trigger set_quick_notes_updated_at
before update on public.quick_notes
for each row execute function public.set_updated_at();

-- RLS queda activo en todas las tablas expuestas a la API.
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.today_priorities enable row level security;
alter table public.quick_notes enable row level security;

-- Los visitantes sin sesión no reciben permisos de tabla.
revoke all on table public.tasks from anon;
revoke all on table public.notes from anon;
revoke all on table public.today_priorities from anon;
revoke all on table public.quick_notes from anon;

grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.notes to authenticated;
grant select, insert, update, delete on table public.today_priorities to authenticated;
grant select, insert, update, delete on table public.quick_notes to authenticated;

-- Cada política compara el usuario de la sesión con user_id.
drop policy if exists "Users select own tasks" on public.tasks;
create policy "Users select own tasks"
on public.tasks for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own tasks" on public.tasks;
create policy "Users insert own tasks"
on public.tasks for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own tasks" on public.tasks;
create policy "Users update own tasks"
on public.tasks for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own tasks" on public.tasks;
create policy "Users delete own tasks"
on public.tasks for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users select own notes" on public.notes;
create policy "Users select own notes"
on public.notes for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own notes" on public.notes;
create policy "Users insert own notes"
on public.notes for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own notes" on public.notes;
create policy "Users update own notes"
on public.notes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own notes" on public.notes;
create policy "Users delete own notes"
on public.notes for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users select own priorities" on public.today_priorities;
create policy "Users select own priorities"
on public.today_priorities for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own priorities" on public.today_priorities;
create policy "Users insert own priorities"
on public.today_priorities for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own priorities" on public.today_priorities;
create policy "Users update own priorities"
on public.today_priorities for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own priorities" on public.today_priorities;
create policy "Users delete own priorities"
on public.today_priorities for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users select own quick note" on public.quick_notes;
create policy "Users select own quick note"
on public.quick_notes for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own quick note" on public.quick_notes;
create policy "Users insert own quick note"
on public.quick_notes for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own quick note" on public.quick_notes;
create policy "Users update own quick note"
on public.quick_notes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own quick note" on public.quick_notes;
create policy "Users delete own quick note"
on public.quick_notes for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
