-- ================================================
-- FIX COMPLETO PARA USER_PROFILES
-- ================================================
-- Ejecuta TODO este script en Supabase SQL Editor
-- ================================================

-- ================================================
-- PASO 1: AGREGAR COLUMNAS FALTANTES
-- ================================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS exclude_from_analytics BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS exclude_reason VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_verified_manually BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_verified_manually_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

SELECT 'PASO 1 COMPLETO: Columnas agregadas' as status;

-- ================================================
-- PASO 2: ACTUALIZAR VALORES NULL A DEFAULTS
-- ================================================

UPDATE user_profiles SET is_active = true WHERE is_active IS NULL;
UPDATE user_profiles SET exclude_from_analytics = false WHERE exclude_from_analytics IS NULL;
UPDATE user_profiles SET email_verified_manually = false WHERE email_verified_manually IS NULL;

SELECT 'PASO 2 COMPLETO: Valores NULL actualizados' as status;

-- ================================================
-- PASO 3: VERIFICAR USUARIO ACTUAL
-- ================================================

SELECT
  'TU USUARIO:' as info,
  id,
  email,
  role,
  is_active,
  exclude_from_analytics
FROM user_profiles
WHERE id = auth.uid();

-- ================================================
-- PASO 4: RECREAR FUNCION is_admin()
-- ================================================

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
    AND (is_active = true OR is_active IS NULL)
  );
$$;

SELECT 'PASO 4 COMPLETO: Funcion is_admin recreada' as status;

-- ================================================
-- PASO 5: VERIFICAR QUE ERES ADMIN
-- ================================================

SELECT
  'SOY ADMIN?' as pregunta,
  public.is_admin() as respuesta;

-- ================================================
-- PASO 6: ELIMINAR POLITICAS CONFLICTIVAS
-- ================================================

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "admin_can_update_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "allow_admin_exclude_from_analytics" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

SELECT 'PASO 6 COMPLETO: Politicas antiguas eliminadas' as status;

-- ================================================
-- PASO 7: CREAR POLITICA DE UPDATE CORRECTA
-- ================================================

CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE
USING (
  -- Puede ver su propio registro O es admin
  auth.uid() = id
  OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
    AND (up.is_active = true OR up.is_active IS NULL)
  )
)
WITH CHECK (
  -- Puede actualizar su propio registro O es admin
  auth.uid() = id
  OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
    AND (up.is_active = true OR up.is_active IS NULL)
  )
);

SELECT 'PASO 7 COMPLETO: Politica de UPDATE creada' as status;

-- ================================================
-- PASO 8: VERIFICAR POLITICAS ACTUALES
-- ================================================

SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- ================================================
-- PASO 9: VERIFICAR COLUMNAS
-- ================================================

SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN (
  'is_active',
  'exclude_from_analytics',
  'exclude_reason',
  'email_verified_manually',
  'email_verified_manually_at',
  'password_changed_at',
  'role'
)
ORDER BY column_name;

-- ================================================
-- PASO 10: TEST - INTENTAR ACTUALIZAR
-- ================================================

-- Este UPDATE deberia funcionar si todo esta bien
DO $$
DECLARE
  v_test_user_id UUID;
BEGIN
  -- Obtener un usuario que NO sea el actual
  SELECT id INTO v_test_user_id
  FROM user_profiles
  WHERE id != auth.uid()
  LIMIT 1;

  IF v_test_user_id IS NOT NULL THEN
    -- Intentar actualizar (esto verificara si las politicas funcionan)
    UPDATE user_profiles
    SET exclude_from_analytics = exclude_from_analytics
    WHERE id = v_test_user_id;

    RAISE NOTICE 'TEST EXITOSO: Pudiste actualizar otro usuario';
  ELSE
    RAISE NOTICE 'No hay otros usuarios para probar';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'TEST FALLIDO: %', SQLERRM;
END $$;

-- ================================================
-- RESUMEN FINAL
-- ================================================

SELECT '=== RESUMEN ===' as titulo;

SELECT
  (SELECT COUNT(*) FROM user_profiles) as total_usuarios,
  (SELECT COUNT(*) FROM user_profiles WHERE role = 'admin') as admins,
  (SELECT COUNT(*) FROM user_profiles WHERE is_active = true) as activos,
  (SELECT COUNT(*) FROM user_profiles WHERE exclude_from_analytics = true) as excluidos_analytics,
  public.is_admin() as tu_eres_admin;

SELECT '=== FIX COMPLETO ===' as status;
