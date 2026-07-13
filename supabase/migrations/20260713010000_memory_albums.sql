-- Álbumes libres para organizar los recuerdos por personas, viajes o cualquier tema.
-- Ejecuta esta migración después de 20260713004000_memories_gallery.sql.

begin;

create table public.memory_albums (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memory_albums_workspace_created_idx
  on public.memory_albums (workspace_id, created_at desc);

create unique index memory_albums_workspace_title_idx
  on public.memory_albums (workspace_id, lower(btrim(title)));

create trigger set_memory_albums_updated_at
before update on public.memory_albums
for each row execute function public.set_updated_at();

alter table public.memory_albums enable row level security;
revoke all on table public.memory_albums from anon;
grant select, insert, update, delete on table public.memory_albums to authenticated;

create policy "Members select workspace memory albums"
on public.memory_albums for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Members insert workspace memory albums"
on public.memory_albums for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

create policy "Members update workspace memory albums"
on public.memory_albums for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "Members delete workspace memory albums"
on public.memory_albums for delete to authenticated
using (public.is_workspace_member(workspace_id));

alter table public.memories add column album_id uuid;

-- Si ya había fotos, las conserva dentro de un álbum inicial.
insert into public.memory_albums (workspace_id, created_by, title, description)
select distinct
  memory.workspace_id,
  workspace.created_by,
  'Momentos',
  'Recuerdos guardados antes de crear los álbumes.'
from public.memories as memory
join public.workspaces as workspace on workspace.id = memory.workspace_id
where memory.album_id is null
on conflict do nothing;

update public.memories as memory
set album_id = (
  select album.id
  from public.memory_albums as album
  where album.workspace_id = memory.workspace_id
  order by
    (lower(btrim(album.title)) = 'momentos') desc,
    album.created_at,
    album.id
  limit 1
)
where memory.album_id is null;

alter table public.memories
  alter column album_id set not null,
  add constraint memories_album_id_fkey
    foreign key (album_id) references public.memory_albums (id) on delete restrict;

create index memories_album_date_idx
  on public.memories (album_id, memory_date desc, created_at desc);

-- Impide relacionar una foto con un álbum de otro workspace.
create or replace function public.ensure_memory_album_workspace()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.memory_albums as album
    where album.id = new.album_id
      and album.workspace_id = new.workspace_id
  ) then
    raise exception 'El álbum no pertenece al workspace del recuerdo.';
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_memory_album_workspace() from public;
grant execute on function public.ensure_memory_album_workspace() to authenticated;

create trigger ensure_memories_album_workspace
before insert or update of album_id, workspace_id on public.memories
for each row execute function public.ensure_memory_album_workspace();

drop policy if exists "Members insert workspace memories" on public.memories;
create policy "Members insert workspace memories"
on public.memories for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.memory_albums as album
    where album.id = memories.album_id
      and album.workspace_id = memories.workspace_id
  )
);

drop policy if exists "Members update workspace memories" on public.memories;
create policy "Members update workspace memories"
on public.memories for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.memory_albums as album
    where album.id = memories.album_id
      and album.workspace_id = memories.workspace_id
  )
);

commit;
