-- Ejecuta estas consultas después de la migración.
-- Deben aparecer cuatro tablas con rowsecurity = true y dieciséis políticas.

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('tasks', 'notes', 'today_priorities', 'quick_notes')
order by tablename;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('tasks', 'notes', 'today_priorities', 'quick_notes')
order by tablename, cmd, policyname;
