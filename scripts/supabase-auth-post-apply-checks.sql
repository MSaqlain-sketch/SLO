-- Read-only production post-apply checks. No fixture writes or role changes.
BEGIN READ ONLY;

-- Both tables: present, RLS enabled, owners reviewed.
SELECT c.relname, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('profiles', 'user_roles')
ORDER BY c.relname;

-- Expect exactly the three reviewed policies.
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('profiles', 'user_roles')
ORDER BY tablename, policyname;

-- Review FK/CHECK/PK definitions and constraint validation.
SELECT conrelid::regclass AS table_name, conname, convalidated,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (to_regclass('public.profiles'), to_regclass('public.user_roles'))
ORDER BY conrelid::regclass::text, conname;

-- Do not print user records. Counts need not remain zero after real signups.
SELECT (SELECT count(*) FROM auth.users) AS auth_users,
       (SELECT count(*) FROM public.profiles) AS profiles,
       (SELECT count(*) FROM public.user_roles) AS user_roles,
       (SELECT count(*) FROM auth.users u
          LEFT JOIN public.profiles p ON p.id = u.id
          WHERE p.id IS NULL) AS missing_profiles,
       (SELECT count(*) FROM auth.users u
          LEFT JOIN public.user_roles r ON r.user_id = u.id
          WHERE r.user_id IS NULL) AS missing_roles;

-- Expect authenticated SELECT on both, only display_name UPDATE.
SELECT role_name,
       has_table_privilege(role_name, 'public.profiles', 'SELECT') AS profile_select,
       has_column_privilege(role_name, 'public.profiles', 'display_name', 'UPDATE') AS display_name_update,
       has_column_privilege(role_name, 'public.profiles', 'id', 'UPDATE') AS identity_update,
       has_column_privilege(role_name, 'public.profiles', 'created_at', 'UPDATE') AS created_at_update,
       has_table_privilege(role_name, 'public.profiles', 'INSERT') AS profile_insert,
       has_table_privilege(role_name, 'public.profiles', 'DELETE') AS profile_delete,
       has_table_privilege(role_name, 'public.user_roles', 'SELECT') AS roles_select,
       has_table_privilege(role_name, 'public.user_roles', 'INSERT') AS roles_insert,
       has_table_privilege(role_name, 'public.user_roles', 'UPDATE') AS roles_update,
       has_table_privilege(role_name, 'public.user_roles', 'DELETE') AS roles_delete
FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name);

-- Expect SECURITY DEFINER, empty search_path, no client EXECUTE.
SELECT p.oid::regprocedure AS function_name, p.prosecdef AS security_definer,
       p.proconfig AS function_settings, pg_get_userbyid(p.proowner) AS owner,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'babul_create_auth_profile';

-- Expect one enabled AFTER INSERT FOR EACH ROW trigger on auth.users.
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND tgname = 'babul_auth_user_created' AND NOT tgisinternal;

-- Expect exactly version 20261104000100 for this first migration.
SELECT CASE
  WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL
    THEN 'FAIL: migration tracking table absent'
  ELSE query_to_xml(
    'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version',
    false, false, ''
  )::text
END AS migration_history;

COMMIT;
