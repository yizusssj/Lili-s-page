-- Permite guardar una fotografía únicamente con su fecha.
-- Ejecuta esta migración después de 20260713010000_memory_albums.sql.

begin;

alter table public.memories
  alter column title drop not null,
  drop constraint if exists memories_title_check;

alter table public.memories
  add constraint memories_title_optional_check check (
    title is null
    or char_length(btrim(title)) between 1 and 120
  );

commit;
