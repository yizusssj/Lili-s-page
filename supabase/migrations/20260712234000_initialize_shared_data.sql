-- Inicializa los datos compartidos una sola vez y guarda las prioridades en bloque.
-- Ejecuta esta migración después de 20260712224500_shared_workspace.sql.

begin;

alter table public.workspaces
  add column if not exists data_initialized_at timestamptz;

create or replace function public.initialize_workspace_data(
  target_workspace_id uuid,
  task_items jsonb,
  note_items jsonb,
  priority_items jsonb,
  quick_note_content text,
  local_date date
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  initialized_at timestamptz;
begin
  if actor_id is null then
    raise exception 'Debes iniciar sesión para inicializar el workspace.'
      using errcode = '42501';
  end if;

  if not public.is_workspace_owner(target_workspace_id) then
    raise exception 'Solo el owner puede inicializar el workspace.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(task_items, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(note_items, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(priority_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Los datos iniciales deben ser arreglos JSON.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(priority_items, '[]'::jsonb)) <> 3 then
    raise exception 'El workspace debe iniciar con tres prioridades.'
      using errcode = '22023';
  end if;

  select workspace.data_initialized_at
  into initialized_at
  from public.workspaces as workspace
  where workspace.id = target_workspace_id
  for update;

  if not found then
    raise exception 'No se encontró el workspace solicitado.'
      using errcode = 'P0002';
  end if;

  -- El bloqueo de la fila evita que dos dispositivos importen al mismo tiempo.
  if initialized_at is not null then
    return false;
  end if;

  -- Si ya hubiera contenido remoto, se conserva y solo se marca como inicializado.
  if exists (select 1 from public.tasks where workspace_id = target_workspace_id)
    or exists (select 1 from public.notes where workspace_id = target_workspace_id)
    or exists (select 1 from public.today_priorities where workspace_id = target_workspace_id)
    or exists (select 1 from public.quick_notes where workspace_id = target_workspace_id) then
    update public.workspaces
    set data_initialized_at = now()
    where id = target_workspace_id;

    return false;
  end if;

  insert into public.tasks (id, workspace_id, created_by, text, done)
  select
    item.id,
    target_workspace_id,
    actor_id,
    item.text,
    coalesce(item.done, false)
  from jsonb_to_recordset(task_items) as item(id uuid, text text, done boolean);

  insert into public.notes (
    id,
    workspace_id,
    created_by,
    title,
    content,
    pinned,
    created_at,
    updated_at
  )
  select
    item.id,
    target_workspace_id,
    actor_id,
    coalesce(item.title, 'Nueva nota'),
    coalesce(item.content, ''),
    coalesce(item.pinned, false),
    coalesce(item.created_at, now()),
    coalesce(item.updated_at, now())
  from jsonb_to_recordset(note_items) as item(
    id uuid,
    title text,
    content text,
    pinned boolean,
    created_at timestamptz,
    updated_at timestamptz
  );

  insert into public.today_priorities (
    id,
    workspace_id,
    created_by,
    position,
    text,
    completed_on
  )
  select
    (entry.value ->> 'id')::uuid,
    target_workspace_id,
    actor_id,
    entry.position::smallint,
    coalesce(entry.value ->> 'text', ''),
    case
      when coalesce((entry.value ->> 'done')::boolean, false) then local_date
      else null
    end
  from jsonb_array_elements(coalesce(priority_items, '[]'::jsonb))
    with ordinality as entry(value, position);

  insert into public.quick_notes (workspace_id, created_by, content)
  values (target_workspace_id, actor_id, coalesce(quick_note_content, ''));

  update public.workspaces
  set data_initialized_at = now()
  where id = target_workspace_id;

  return true;
end;
$$;

create or replace function public.save_workspace_priorities(
  target_workspace_id uuid,
  priority_items jsonb,
  local_date date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'No perteneces al workspace solicitado.'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(priority_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(priority_items, '[]'::jsonb)) <> 3 then
    raise exception 'Debes guardar exactamente tres prioridades.'
      using errcode = '22023';
  end if;

  with input as (
    select
      entry.position::smallint as position,
      coalesce(entry.value ->> 'text', '') as text,
      coalesce((entry.value ->> 'done')::boolean, false) as done
    from jsonb_array_elements(coalesce(priority_items, '[]'::jsonb))
      with ordinality as entry(value, position)
  ), updated as (
    update public.today_priorities as priority
    set
      text = input.text,
      completed_on = case when input.done then local_date else null end
    from input
    where priority.workspace_id = target_workspace_id
      and priority.position = input.position
    returning priority.id
  )
  select count(*) into updated_count from updated;

  if updated_count <> 3 then
    raise exception 'No se encontraron las tres prioridades del workspace.'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.initialize_workspace_data(uuid, jsonb, jsonb, jsonb, text, date)
  from public;
revoke all on function public.save_workspace_priorities(uuid, jsonb, date)
  from public;

grant execute on function public.initialize_workspace_data(uuid, jsonb, jsonb, jsonb, text, date)
  to authenticated;
grant execute on function public.save_workspace_priorities(uuid, jsonb, date)
  to authenticated;

commit;
