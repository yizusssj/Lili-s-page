-- Repara proyectos donde la columna title de memories todavía quedó obligatoria.
-- Las fotografías pueden guardarse únicamente con su fecha y añadir detalles después.

begin;

alter table public.memories
  alter column title drop not null,
  drop constraint if exists memories_title_check,
  drop constraint if exists memories_title_optional_check;

alter table public.memories
  add constraint memories_title_optional_check check (
    title is null
    or char_length(btrim(title)) between 1 and 120
  );

commit;

notify pgrst, 'reload schema';
