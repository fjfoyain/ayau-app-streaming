-- ================================================
-- DIAGNÓSTICO Y REPARACIÓN COMPLETA
-- ================================================
-- Ejecuta este script completo en el SQL Editor de Supabase
-- Paso 1: Diagnóstico
-- Paso 2: Limpieza de políticas
-- Paso 3: Recreación de funciones y políticas
-- Paso 4: Verificación

-- ================================================
-- PASO 1: DIAGNÓSTICO - Ver estado actual
-- ================================================

-- 1.1 Ver todos los usuarios admin/manager
SELECT
  '=== USUARIOS ADMIN/MANAGER ===' as info;

SELECT
  id,
  email,
  full_name,
  role,
  access_level,
  client_id,
  location_id,
  is_active
FROM user_profiles
WHERE role IN ('admin', 'manager')
ORDER BY role, email;

-- 1.2 Ver políticas actuales en user_profiles
SELECT
  '=== POLÍTICAS EN user_profiles ===' as info;

SELECT
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'user_profiles';

-- ================================================
-- PASO 2: LIMPIAR TODAS LAS POLÍTICAS PROBLEMÁTICAS
-- ================================================

-- Eliminar TODAS las políticas de user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON user_profiles;
DROP POLICY IF EXISTS "Enable update for users" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for admins" ON user_profiles;
DROP POLICY IF EXISTS "Enable delete for admins" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their scope" ON user_profiles;

-- Eliminar políticas de clients
DROP POLICY IF EXISTS "Users can view their client" ON clients;
DROP POLICY IF EXISTS "Managers can manage clients" ON clients;
DROP POLICY IF EXISTS "Admins and managers can manage clients" ON clients;
DROP POLICY IF EXISTS "clients_select_policy" ON clients;

-- Eliminar políticas de locations
DROP POLICY IF EXISTS "Users can view accessible locations" ON locations;
DROP POLICY IF EXISTS "Managers can manage locations" ON locations;
DROP POLICY IF EXISTS "Admins and managers can manage locations" ON locations;
DROP POLICY IF EXISTS "locations_select_policy" ON locations;

SELECT '=== POLÍTICAS ELIMINADAS ===' as info;

-- ================================================
-- PASO 3: RECREAR FUNCIONES HELPER
-- ================================================

-- Función is_admin (SECURITY DEFINER para evitar recursión)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  );
$$;

-- Función is_manager_or_admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
    AND is_active = true
  );
$$;

-- Función user_has_client_access (ARREGLADA para admins)
CREATE OR REPLACE FUNCTION public.user_has_client_access(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND is_active = true
    AND (
      -- Admin y Manager tienen acceso a todo
      role IN ('admin', 'manager')
      OR
      -- Usuario con acceso a nivel cuenta
      (access_level = 'account' AND client_id = target_client_id)
      OR
      -- Usuario con acceso a nivel local cuya ubicación pertenece a este cliente
      (access_level = 'location' AND location_id IN (
        SELECT id FROM locations WHERE client_id = target_client_id
      ))
    )
  );
$$;

-- Función user_has_location_access (ARREGLADA para admins)
CREATE OR REPLACE FUNCTION public.user_has_location_access(target_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.is_active = true
    AND (
      -- Admin y Manager tienen acceso a todo
      up.role IN ('admin', 'manager')
      OR
      -- Usuario con acceso a nivel cuenta (puede ver todas las ubicaciones de su cliente)
      (up.access_level = 'account' AND EXISTS (
        SELECT 1 FROM locations l
        WHERE l.id = target_location_id
        AND l.client_id = up.client_id
      ))
      OR
      -- Usuario con acceso a nivel local (solo su ubicación específica)
      (up.access_level = 'location' AND up.location_id = target_location_id)
    )
  );
$$;

SELECT '=== FUNCIONES HELPER RECREADAS ===' as info;

-- ================================================
-- PASO 4: CREAR POLÍTICAS RLS SIMPLES Y CORRECTAS
-- ================================================

-- Habilitar RLS en las tablas (por si acaso)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------
-- Políticas para user_profiles
-- ----------------------------------------

-- SELECT: Usuarios ven su perfil, admins/managers ven todo
CREATE POLICY "user_profiles_select" ON user_profiles
FOR SELECT USING (
  auth.uid() = id
  OR
  public.is_manager_or_admin()
);

-- INSERT: Solo admins pueden crear perfiles
CREATE POLICY "user_profiles_insert" ON user_profiles
FOR INSERT WITH CHECK (
  public.is_admin()
);

-- UPDATE: Usuarios actualizan su perfil, admins actualizan todo
CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE USING (
  auth.uid() = id
  OR
  public.is_admin()
);

-- DELETE: Solo admins pueden eliminar
CREATE POLICY "user_profiles_delete" ON user_profiles
FOR DELETE USING (
  public.is_admin()
);

-- ----------------------------------------
-- Políticas para clients
-- ----------------------------------------

-- SELECT: Admins/managers ven todo, otros según su acceso
CREATE POLICY "clients_select" ON clients
FOR SELECT USING (
  public.user_has_client_access(id)
);

-- INSERT/UPDATE/DELETE: Solo admins y managers
CREATE POLICY "clients_manage" ON clients
FOR ALL USING (
  public.is_manager_or_admin()
) WITH CHECK (
  public.is_manager_or_admin()
);

-- ----------------------------------------
-- Políticas para locations
-- ----------------------------------------

-- SELECT: Según acceso del usuario
CREATE POLICY "locations_select" ON locations
FOR SELECT USING (
  public.user_has_location_access(id)
);

-- INSERT/UPDATE/DELETE: Solo admins y managers
CREATE POLICY "locations_manage" ON locations
FOR ALL USING (
  public.is_manager_or_admin()
) WITH CHECK (
  public.is_manager_or_admin()
);

SELECT '=== POLÍTICAS RLS CREADAS ===' as info;

-- ================================================
-- PASO 5: ASEGURAR QUE ADMIN TENGA ACCESO
-- ================================================

-- Asegurar que usuarios admin/manager tengan access_level NULL
UPDATE user_profiles
SET access_level = NULL
WHERE role IN ('admin', 'manager');

-- Asegurar que estén activos
UPDATE user_profiles
SET is_active = true
WHERE role IN ('admin', 'manager');

SELECT '=== USUARIOS ADMIN ACTUALIZADOS ===' as info;

-- ================================================
-- PASO 6: VERIFICACIÓN FINAL
-- ================================================

SELECT
  '=== VERIFICACIÓN: USUARIOS ADMIN ===' as info;

SELECT
  id,
  email,
  role,
  access_level,
  is_active,
  public.is_admin() as fn_is_admin,
  public.is_manager_or_admin() as fn_is_manager_or_admin
FROM user_profiles
WHERE role IN ('admin', 'manager');

SELECT
  '=== VERIFICACIÓN: POLÍTICAS FINALES ===' as info;

SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('user_profiles', 'clients', 'locations')
ORDER BY tablename, policyname;

SELECT
  '=== ¡REPARACIÓN COMPLETADA! ===' as info,
  'Ahora cierra sesión y vuelve a iniciar en la app' as siguiente_paso;
