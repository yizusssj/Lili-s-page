-- Ejecuta cada bloque para verificar la migración compartida.

-- Resultado esperado: 8 tablas y rowsecurity = true en todas.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'workspaces',
    'workspace_members',
    'tasks',
    'notes',
    'memory_albums',
    'memories',
    'today_priorities',
    'quick_notes'
  )
order by tablename;

-- Resultado esperado: 32 políticas públicas, todas para authenticated.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'workspaces',
    'workspace_members',
    'tasks',
    'notes',
    'memory_albums',
    'memories',
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

-- Resultado esperado: 4 funciones con security_type = INVOKER.
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'initialize_workspace_data',
    'ensure_memory_album_workspace',
    'memory_workspace_from_path',
    'save_workspace_priorities'
  )
order by routine_name;

-- Después del primer inicio de la aplicación: data_initialized_at con una fecha.
select id, name, data_initialized_at
from public.workspaces
order by created_at;

-- Después de 20260713013000_optional_memory_details.sql: is_nullable = YES.
select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'memories'
  and column_name = 'title';

-- Después de 20260713004000_memories_gallery.sql: bucket privado y límite de 8 MB.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'memory-images';

-- Resultado esperado: 3 políticas para authenticated.
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Members read workspace memory images',
    'Members upload workspace memory images',
    'Members delete workspace memory images'
  )
order by cmd, policyname;
