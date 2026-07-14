-- Crea un workspace privado para una cuenta existente de Authentication > Users.
-- La cuenta queda como owner de su espacio y deja de pertenecer a otros workspaces.
-- Reemplaza únicamente USER_EMAIL_HERE antes de ejecutar.

do $$
declare
  user_email text := 'valdezhdez00@gmail.com';
  personal_workspace_name text := 'Espacio de Lili';
  target_user_id uuid;
  personal_workspace_id uuid;
begin
  if user_email = 'USER_EMAIL_HERE' then
    raise exception 'Reemplaza USER_EMAIL_HERE por el correo antes de ejecutar.';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(user_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No existe un usuario con el correo %.', user_email;
  end if;

  -- Quita a esta cuenta de workspaces creados por otras personas.
  delete from public.workspace_members as member
  using public.workspaces as workspace
  where member.workspace_id = workspace.id
    and member.user_id = target_user_id
    and workspace.created_by <> target_user_id;

  -- Reutiliza un workspace propio si el script ya se ejecutó anteriormente.
  select id
  into personal_workspace_id
  from public.workspaces
  where created_by = target_user_id
  order by created_at asc
  limit 1;

  if personal_workspace_id is null then
    insert into public.workspaces (name, created_by)
    values (personal_workspace_name, target_user_id)
    returning id into personal_workspace_id;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (personal_workspace_id, target_user_id, 'owner')
  on conflict (workspace_id, user_id)
  do update set role = 'owner';

  -- Inicializa una estructura vacía directamente en Supabase.
  -- Así el navegador no importa la copia local de otra cuenta.
  insert into public.today_priorities (
    workspace_id,
    created_by,
    position,
    text,
    completed_on
  )
  values
    (personal_workspace_id, target_user_id, 1, 'Prioridad 1', null),
    (personal_workspace_id, target_user_id, 2, 'Prioridad 2', null),
    (personal_workspace_id, target_user_id, 3, 'Prioridad 3', null)
  on conflict (workspace_id, position) do nothing;

  insert into public.quick_notes (workspace_id, created_by, content)
  values (personal_workspace_id, target_user_id, '')
  on conflict (workspace_id) do nothing;

  update public.workspaces
  set data_initialized_at = coalesce(data_initialized_at, now())
  where id = personal_workspace_id;

  raise notice 'Workspace privado preparado correctamente: %', personal_workspace_id;
end;
$$;
