-- Repeticiones mensuales sencillas para tareas y eventos del calendario.
-- Puede ejecutarse más de una vez sin eliminar datos existentes.

begin;

alter table public.tasks
  add column if not exists recurrence text not null default 'once';

alter table public.tasks
  add column if not exists recurrence_completed_dates jsonb not null default '[]'::jsonb;

alter table public.tasks
  drop constraint if exists tasks_recurrence_check;

alter table public.tasks
  add constraint tasks_recurrence_check
  check (recurrence in ('once', 'monthly_year', 'monthly_forever'));

alter table public.tasks
  drop constraint if exists tasks_recurrence_requires_date_check;

alter table public.tasks
  add constraint tasks_recurrence_requires_date_check
  check (recurrence = 'once' or due_date is not null);

alter table public.tasks
  drop constraint if exists tasks_recurrence_completed_dates_check;

alter table public.tasks
  add constraint tasks_recurrence_completed_dates_check
  check (jsonb_typeof(recurrence_completed_dates) = 'array');

create index if not exists tasks_workspace_recurrence_idx
  on public.tasks (workspace_id, recurrence, due_date)
  where recurrence <> 'once';

commit;
