-- Ejecuta este archivo después de crear la cuenta de ella en Authentication > Users.
-- Reemplaza OWNER_EMAIL_HERE y MEMBER_EMAIL_HERE antes de ejecutar.

do $$
declare
  owner_email text := 'OWNER_EMAIL_HERE';
  member_email text := 'MEMBER_EMAIL_HERE';
  owner_user_id uuid;
  member_user_id uuid;
  shared_workspace_id uuid;
begin
  if owner_email = 'OWNER_EMAIL_HERE' or member_email = 'MEMBER_EMAIL_HERE' then
    raise exception 'Reemplaza los dos correos antes de ejecutar.';
  end if;

  select id into owner_user_id
  from auth.users
  where lower(email) = lower(owner_email)
  limit 1;

  select id into member_user_id
  from auth.users
  where lower(email) = lower(member_email)
  limit 1;

  if owner_user_id is null then
    raise exception 'No existe el owner con correo %.', owner_email;
  end if;

  if member_user_id is null then
    raise exception 'No existe el member con correo %.', member_email;
  end if;

  select id into shared_workspace_id
  from public.workspaces
  where created_by = owner_user_id
    and name = 'Lili''s Workspace'
  limit 1;

  if shared_workspace_id is null then
    raise exception 'Primero ejecuta bootstrap_owner.sql para %.', owner_email;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (shared_workspace_id, member_user_id, 'member')
  on conflict (workspace_id, user_id)
  do update set
    role = case
      when workspace_members.role = 'owner' then 'owner'
      else excluded.role
    end;

  raise notice 'Miembro añadido correctamente al workspace: %', shared_workspace_id;
end;
$$;
