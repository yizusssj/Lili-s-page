-- Edición y eliminación segura de álbumes.
-- Ejecuta esta migración después de 20260713020000_album_custom_covers.sql.

begin;

create or replace function public.delete_memory_album(
  target_workspace_id uuid,
  target_album_id uuid,
  verify_only boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'No tienes acceso a este workspace.';
  end if;

  if not exists (
    select 1
    from public.memory_albums as album
    where album.id = target_album_id
      and album.workspace_id = target_workspace_id
  ) then
    raise exception 'El álbum no existe en este workspace.';
  end if;

  if verify_only then
    return;
  end if;

  delete from public.memories
  where album_id = target_album_id
    and workspace_id = target_workspace_id;

  delete from public.memory_albums
  where id = target_album_id
    and workspace_id = target_workspace_id;
end;
$$;

revoke all on function public.delete_memory_album(uuid, uuid, boolean) from public;
grant execute on function public.delete_memory_album(uuid, uuid, boolean) to authenticated;

commit;
