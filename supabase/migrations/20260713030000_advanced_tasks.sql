-- Añade organización avanzada a las tareas existentes sin eliminar datos.
-- Puede ejecutarse más de una vez.

begin;

alter table public.tasks
  add column if not exists due_date date;

alter table public.tasks
  add column if not exists priority text not null default 'medium';

alter table public.tasks
  drop constraint if exists tasks_priority_check;

alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('low', 'medium', 'high'));

create index if not exists tasks_workspace_status_due_date_idx
  on public.tasks (workspace_id, done, due_date, priority);

commit;
