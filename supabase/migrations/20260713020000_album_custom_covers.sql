-- Portada personalizada opcional para cada álbum.
-- Si queda en null, la aplicación usa automáticamente la foto añadida más reciente.
-- Ejecuta esta migración después de 20260713013000_optional_memory_details.sql.

begin;

alter table public.memory_albums
  add column cover_memory_id uuid
  references public.memories (id) on delete set null;

create or replace function public.ensure_album_cover_memory()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.cover_memory_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.memories as memory
    where memory.id = new.cover_memory_id
      and memory.album_id = new.id
      and memory.workspace_id = new.workspace_id
  ) then
    raise exception 'La portada debe pertenecer al mismo álbum.';
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_album_cover_memory() from public;
grant execute on function public.ensure_album_cover_memory() to authenticated;

create trigger ensure_memory_album_cover
before insert or update of cover_memory_id, workspace_id on public.memory_albums
for each row execute function public.ensure_album_cover_memory();

commit;
