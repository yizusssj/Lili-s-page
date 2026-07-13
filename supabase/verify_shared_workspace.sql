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
