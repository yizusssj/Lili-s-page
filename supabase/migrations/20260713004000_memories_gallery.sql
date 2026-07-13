-- Galería privada de recuerdos compartidos.
-- Ejecuta esta migración después de 20260712234000_initialize_shared_data.sql.

begin;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  memory_date date not null default current_date check (memory_date <= current_date),
  storage_path text not null unique check (
    char_length(storage_path) <= 500
    and storage_path like workspace_id::text || '/%'
  ),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size integer not null check (file_size between 1 and 8388608),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_workspace_date_idx
  on public.memories (workspace_id, memory_date desc, created_at desc);

drop trigger if exists set_memories_updated_at on public.memories;
create trigger set_memories_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

alter table public.memories enable row level security;
revoke all on table public.memories from anon;
grant select, insert, update, delete on table public.memories to authenticated;

drop policy if exists "Members select workspace memories" on public.memories;
create policy "Members select workspace memories"
on public.memories for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members insert workspace memories" on public.memories;
create policy "Members insert workspace memories"
on public.memories for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists "Members update workspace memories" on public.memories;
create policy "Members update workspace memories"
on public.memories for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members delete workspace memories" on public.memories;
create policy "Members delete workspace memories"
on public.memories for delete to authenticated
using (public.is_workspace_member(workspace_id));

-- El bucket permanece privado y limita tamaño y formatos incluso si el cliente falla.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'memory-images',
  'memory-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Convierte de forma segura el primer segmento workspace-id/archivo.jpg.
create or replace function public.memory_workspace_from_path(object_name text)
returns uuid
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  folder_name text;
begin
  folder_name := split_part(object_name, '/', 1);
  if folder_name = '' then return null; end if;
  return folder_name::uuid;
exception
  when invalid_text_representation then return null;
end;
$$;

revoke all on function public.memory_workspace_from_path(text) from public;
grant execute on function public.memory_workspace_from_path(text) to authenticated;

drop policy if exists "Members read workspace memory images" on storage.objects;
create policy "Members read workspace memory images"
on storage.objects for select to authenticated
using (
  bucket_id = 'memory-images'
  and public.is_workspace_member(public.memory_workspace_from_path(name))
);

drop policy if exists "Members upload workspace memory images" on storage.objects;
create policy "Members upload workspace memory images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'memory-images'
  and public.is_workspace_member(public.memory_workspace_from_path(name))
);

drop policy if exists "Members delete workspace memory images" on storage.objects;
create policy "Members delete workspace memory images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'memory-images'
  and public.is_workspace_member(public.memory_workspace_from_path(name))
);

commit;
