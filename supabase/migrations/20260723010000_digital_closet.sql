-- Clóset digital compartido: prendas con fotografía, outfits y control ligero de lavado.

begin;

create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  name text check (name is null or char_length(btrim(name)) between 1 and 100),
  category text not null default 'other'
    check (category in ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'other')),
  color text check (color is null or char_length(btrim(color)) between 1 and 40),
  brand text check (brand is null or char_length(btrim(brand)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'available' check (status in ('available', 'laundry')),
  favorite boolean not null default false,
  last_worn_on date,
  wear_count integer not null default 0 check (wear_count >= 0),
  storage_path text not null unique check (
    char_length(storage_path) <= 500
    and storage_path like workspace_id::text || '/%'
  ),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size integer not null check (file_size between 1 and 8388608),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create index if not exists clothing_items_workspace_category_idx
  on public.clothing_items (workspace_id, category, created_at desc);
create index if not exists clothing_items_workspace_laundry_idx
  on public.clothing_items (workspace_id, status)
  where status = 'laundry';

drop trigger if exists set_clothing_items_updated_at on public.clothing_items;
create trigger set_clothing_items_updated_at
before update on public.clothing_items
for each row execute function public.set_updated_at();

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  name text check (name is null or char_length(btrim(name)) between 1 and 100),
  occasion text check (occasion is null or char_length(btrim(occasion)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 1000),
  planned_for date,
  worn_on date,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create index if not exists outfits_workspace_planned_idx
  on public.outfits (workspace_id, planned_for, created_at desc);

drop trigger if exists set_outfits_updated_at on public.outfits;
create trigger set_outfits_updated_at
before update on public.outfits
for each row execute function public.set_updated_at();

create table if not exists public.outfit_items (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  outfit_id uuid not null,
  clothing_item_id uuid not null,
  position smallint not null check (position between 0 and 20),
  created_at timestamptz not null default now(),
  primary key (outfit_id, clothing_item_id),
  unique (outfit_id, position),
  foreign key (workspace_id, outfit_id)
    references public.outfits (workspace_id, id) on delete cascade,
  foreign key (workspace_id, clothing_item_id)
    references public.clothing_items (workspace_id, id) on delete cascade
);

create index if not exists outfit_items_clothing_idx
  on public.outfit_items (clothing_item_id, outfit_id);

alter table public.clothing_items enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

revoke all on table public.clothing_items, public.outfits, public.outfit_items from anon;
grant select, insert, update, delete
  on table public.clothing_items, public.outfits, public.outfit_items
  to authenticated;

drop policy if exists "Members select clothing items" on public.clothing_items;
create policy "Members select clothing items"
on public.clothing_items for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members insert clothing items" on public.clothing_items;
create policy "Members insert clothing items"
on public.clothing_items for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists "Members update clothing items" on public.clothing_items;
create policy "Members update clothing items"
on public.clothing_items for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members delete clothing items" on public.clothing_items;
create policy "Members delete clothing items"
on public.clothing_items for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members select outfits" on public.outfits;
create policy "Members select outfits"
on public.outfits for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members insert outfits" on public.outfits;
create policy "Members insert outfits"
on public.outfits for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists "Members update outfits" on public.outfits;
create policy "Members update outfits"
on public.outfits for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members delete outfits" on public.outfits;
create policy "Members delete outfits"
on public.outfits for delete to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members select outfit items" on public.outfit_items;
create policy "Members select outfit items"
on public.outfit_items for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Members insert outfit items" on public.outfit_items;
create policy "Members insert outfit items"
on public.outfit_items for insert to authenticated
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members update outfit items" on public.outfit_items;
create policy "Members update outfit items"
on public.outfit_items for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members delete outfit items" on public.outfit_items;
create policy "Members delete outfit items"
on public.outfit_items for delete to authenticated
using (public.is_workspace_member(workspace_id));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'closet-images',
  'closet-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.closet_workspace_from_path(object_name text)
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

revoke all on function public.closet_workspace_from_path(text) from public;
grant execute on function public.closet_workspace_from_path(text) to authenticated;

drop policy if exists "Members read closet images" on storage.objects;
create policy "Members read closet images"
on storage.objects for select to authenticated
using (
  bucket_id = 'closet-images'
  and public.is_workspace_member(public.closet_workspace_from_path(name))
);

drop policy if exists "Members upload closet images" on storage.objects;
create policy "Members upload closet images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'closet-images'
  and public.is_workspace_member(public.closet_workspace_from_path(name))
);

drop policy if exists "Members delete closet images" on storage.objects;
create policy "Members delete closet images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'closet-images'
  and public.is_workspace_member(public.closet_workspace_from_path(name))
);

create or replace function public.mark_outfit_worn(
  target_workspace_id uuid,
  target_outfit_id uuid,
  worn_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'No tienes acceso a este workspace.';
  end if;

  update public.outfits
  set worn_on = worn_date
  where workspace_id = target_workspace_id
    and id = target_outfit_id;

  if not found then
    raise exception 'No se encontró el outfit.';
  end if;

  update public.clothing_items as item
  set
    last_worn_on = worn_date,
    wear_count = item.wear_count + 1
  where item.workspace_id = target_workspace_id
    and item.id in (
      select relation.clothing_item_id
      from public.outfit_items as relation
      where relation.workspace_id = target_workspace_id
        and relation.outfit_id = target_outfit_id
    );
end;
$$;

revoke all on function public.mark_outfit_worn(uuid, uuid, date) from public;
grant execute on function public.mark_outfit_worn(uuid, uuid, date) to authenticated;

create or replace function public.save_outfit(
  target_workspace_id uuid,
  target_outfit_id uuid,
  target_name text,
  target_occasion text,
  target_notes text,
  target_planned_for date,
  target_favorite boolean,
  target_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_count integer := cardinality(target_item_ids);
  available_count integer;
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'No tienes acceso a este workspace.';
  end if;

  if exists (
    select 1
    from public.outfits as existing_outfit
    where existing_outfit.id = target_outfit_id
      and existing_outfit.workspace_id <> target_workspace_id
  ) then
    raise exception 'El outfit no pertenece a este workspace.';
  end if;

  if requested_count is null or requested_count < 1 or requested_count > 8 then
    raise exception 'Un outfit debe contener entre 1 y 8 prendas.';
  end if;

  select count(distinct item.id)
  into available_count
  from public.clothing_items as item
  where item.workspace_id = target_workspace_id
    and item.id = any(target_item_ids);

  if available_count <> requested_count then
    raise exception 'Una de las prendas no pertenece a este clóset.';
  end if;

  insert into public.outfits (
    id,
    workspace_id,
    created_by,
    name,
    occasion,
    notes,
    planned_for,
    favorite
  )
  values (
    target_outfit_id,
    target_workspace_id,
    (select auth.uid()),
    nullif(btrim(left(coalesce(target_name, ''), 100)), ''),
    nullif(btrim(left(coalesce(target_occasion, ''), 80)), ''),
    left(coalesce(target_notes, ''), 1000),
    target_planned_for,
    coalesce(target_favorite, false)
  )
  on conflict (id) do update set
    name = excluded.name,
    occasion = excluded.occasion,
    notes = excluded.notes,
    planned_for = excluded.planned_for,
    favorite = excluded.favorite;

  delete from public.outfit_items
  where workspace_id = target_workspace_id
    and outfit_id = target_outfit_id;

  insert into public.outfit_items (
    workspace_id,
    outfit_id,
    clothing_item_id,
    position
  )
  select
    target_workspace_id,
    target_outfit_id,
    selected.item_id,
    selected.position - 1
  from unnest(target_item_ids) with ordinality as selected(item_id, position);
end;
$$;

revoke all on function public.save_outfit(
  uuid, uuid, text, text, text, date, boolean, uuid[]
) from public;
grant execute on function public.save_outfit(
  uuid, uuid, text, text, text, date, boolean, uuid[]
) to authenticated;

commit;
