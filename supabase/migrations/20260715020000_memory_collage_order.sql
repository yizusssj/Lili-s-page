-- Conserva el orden visual de las fotografías dentro de cada álbum.

begin;

alter table public.memories
  add column if not exists sort_order bigint;

with ordered_memories as (
  select
    id,
    floor(extract(epoch from created_at) * 1000)::bigint * 1000
      + row_number() over (
        partition by album_id
        order by created_at, id
      ) as next_sort_order
  from public.memories
)
update public.memories as memory
set sort_order = ordered.next_sort_order
from ordered_memories as ordered
where memory.id = ordered.id
  and memory.sort_order is null;

alter table public.memories
  alter column sort_order set default (
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint * 1000
  ),
  alter column sort_order set not null;

alter table public.memories
  drop constraint if exists memories_sort_order_positive_check;

alter table public.memories
  add constraint memories_sort_order_positive_check check (sort_order > 0);

create index if not exists memories_album_sort_order_idx
  on public.memories (album_id, sort_order, id);

commit;
