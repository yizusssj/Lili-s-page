-- Papelera recuperable para tareas, notas, recuerdos y albumes.
-- Los archivos de Storage se conservan hasta la eliminacion permanente.

begin;

alter table public.tasks
  add column if not exists deleted_at timestamptz;

alter table public.notes
  add column if not exists deleted_at timestamptz;

alter table public.memories
  add column if not exists deleted_at timestamptz;

alter table public.memory_albums
  add column if not exists deleted_at timestamptz;

create index if not exists tasks_workspace_deleted_idx
  on public.tasks (workspace_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists notes_workspace_deleted_idx
  on public.notes (workspace_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists memories_workspace_deleted_idx
  on public.memories (workspace_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists memory_albums_workspace_deleted_idx
  on public.memory_albums (workspace_id, deleted_at desc)
  where deleted_at is not null;

-- Un album enviado a la papelera no debe impedir crear otro con el mismo nombre.
drop index if exists public.memory_albums_workspace_title_idx;

create unique index memory_albums_workspace_title_idx
  on public.memory_albums (workspace_id, lower(btrim(title)))
  where deleted_at is null;

commit;
