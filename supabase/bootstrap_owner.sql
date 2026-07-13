-- Ejecuta este archivo después de crear tu usuario en Authentication > Users.
-- Reemplaza únicamente OWNER_EMAIL_HERE por tu correo real.

do $$
declare
  owner_email text := 'OWNER_EMAIL_HERE';
  owner_user_id uuid;
  shared_workspace_id uuid;
begin
  if owner_email = 'OWNER_EMAIL_HERE' then
    raise exception 'Reemplaza OWNER_EMAIL_HERE por tu correo antes de ejecutar.';
  end if;

  select id
  into owner_user_id
  from auth.users
  where lower(email) = lower(owner_email)
  limit 1;

  if owner_user_id is null then
    raise exception 'No existe un usuario con el correo %.', owner_email;
  end if;

  select id
  into shared_workspace_id
  from public.workspaces
  where created_by = owner_user_id
    and name = 'Lili''s Workspace'
  limit 1;

  if shared_workspace_id is null then
    insert into public.workspaces (name, created_by)
    values ('Lili''s Workspace', owner_user_id)
    returning id into shared_workspace_id;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (shared_workspace_id, owner_user_id, 'owner')
  on conflict (workspace_id, user_id)
  do update set role = 'owner';

  raise notice 'Workspace preparado correctamente: %', shared_workspace_id;
end;
$$;
