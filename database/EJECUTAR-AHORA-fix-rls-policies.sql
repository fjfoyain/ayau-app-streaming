-- ================================================
-- FIX RLS POLICIES FOR USER_PROFILES
-- ================================================
-- Este script arregla los permisos para que admins
-- puedan actualizar exclude_from_analytics, is_active, etc.
-- ================================================

-- Primero, ver las políticas actuales
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'user_profiles';

-- ================================================
-- OPCION 1: Actualizar política existente de admin
-- ================================================

-- Eliminar política conflictiva si existe
DROP POLICY IF EXISTS "allow_admin_exclude_from_analytics" ON user_profiles;
DROP POLICY IF EXISTS "admin_full_access" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Crear política que permite a admins actualizar CUALQUIER campo
CREATE POLICY "admin_can_update_all_profiles"
ON user_profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

-- También asegurar que admins pueden SELECT
DROP POLICY IF EXISTS "admin_can_select_all_profiles" ON user_profiles;
CREATE POLICY "admin_can_select_all_profiles"
ON user_profiles
FOR SELECT
USING (
  -- El usuario puede ver su propio perfil
  auth.uid() = id
  OR
  -- O es admin y puede ver todos
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

-- ================================================
-- VERIFICACION
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE ' RLS POLICIES ACTUALIZADAS';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Politicas creadas:';
  RAISE NOTICE '  - admin_can_update_all_profiles (UPDATE)';
  RAISE NOTICE '  - admin_can_select_all_profiles (SELECT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Ahora los admins pueden:';
  RAISE NOTICE '  - Actualizar exclude_from_analytics';
  RAISE NOTICE '  - Actualizar is_active';
  RAISE NOTICE '  - Actualizar email_verified_manually';
  RAISE NOTICE '  - Actualizar role';
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
END $$;

-- Ver las nuevas políticas
SELECT policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'user_profiles';
