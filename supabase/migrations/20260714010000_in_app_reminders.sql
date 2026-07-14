-- Añade hora y recordatorios internos a las tareas existentes sin eliminar datos.
-- Puede ejecutarse más de una vez.

begin;

alter table public.tasks
  add column if not exists due_time time without time zone;

alter table public.tasks
  add column if not exists reminder_minutes_before integer;

alter table public.tasks
  add column if not exists reminder_acknowledged_at timestamptz;

alter table public.tasks
  drop constraint if exists tasks_due_time_requires_date_check;

alter table public.tasks
  add constraint tasks_due_time_requires_date_check
  check (due_time is null or due_date is not null);

alter table public.tasks
  drop constraint if exists tasks_reminder_schedule_check;

alter table public.tasks
  add constraint tasks_reminder_schedule_check
  check (
    reminder_minutes_before is null
    or (
      reminder_minutes_before in (0, 60, 1440)
      and due_date is not null
      and due_time is not null
    )
  );

create index if not exists tasks_workspace_reminder_schedule_idx
  on public.tasks (workspace_id, done, due_date, due_time)
  where reminder_minutes_before is not null;

commit;
