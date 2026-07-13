-- Ejecuta cada bloque para verificar la migración compartida.

-- Resultado esperado: 6 tablas y rowsecurity = true en todas.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'workspaces',
    'workspace_members',
    'tasks',
    'notes',
    'today_priorities',
    'quick_notes'
  )
order by tablename;

-- Resultado esperado: 24 políticas, todas para authenticated.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'workspaces',
    'workspace_members',
    'tasks',
    'notes',
    'today_priorities',
    'quick_notes'
  )
order by tablename, cmd, policyname;

-- Después de bootstrap_owner.sql: una fila owner.
-- Después de add_member.sql: una fila owner y una fila member.
select
  workspace.name,
  auth_user.email,
  member.role,
  member.joined_at
from public.workspace_members as member
join public.workspaces as workspace on workspace.id = member.workspace_id
join auth.users as auth_user on auth_user.id = member.user_id
order by workspace.name, member.role desc, auth_user.email;

-- Después de 20260712234000_initialize_shared_data.sql: una fila.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'workspaces'
  and column_name = 'data_initialized_at';

-- Resultado esperado: 2 funciones con security_type = INVOKER.
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'initialize_workspace_data',
    'save_workspace_priorities'
  )
order by routine_name;

-- Después del primer inicio de la aplicación: data_initialized_at con una fecha.
select id, name, data_initialized_at
from public.workspaces
order by created_at;
