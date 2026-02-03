-- ================================================
-- FIX URGENTE - INFINITE RECURSION
-- ================================================
-- EJECUTAR INMEDIATAMENTE
-- ================================================

-- PASO 1: ELIMINAR TODAS LAS POLITICAS PROBLEMATICAS
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'user_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', policy_record.policyname);
  END LOOP;
END $$;

-- PASO 2: CREAR FUNCIONES HELPER CON SECURITY DEFINER (evitan RLS)

-- Funcion para verificar si es admin (no causa recursion)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_is_active BOOLEAN;
BEGIN
  SELECT role, is_active INTO v_role, v_is_active
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN v_role = 'admin' AND COALESCE(v_is_active, true);
END;
$$;

-- Funcion para verificar si es admin o manager
CREATE OR REPLACE FUNCTION public.check_is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_is_active BOOLEAN;
BEGIN
  SELECT role, is_active INTO v_role, v_is_active
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN v_role IN ('admin', 'manager') AND COALESCE(v_is_active, true);
END;
$$;

-- PASO 3: CREAR POLITICAS SIN RECURSION (usando las funciones)

-- SELECT: Usuario ve su perfil o es admin/manager
CREATE POLICY "up_select" ON user_profiles
FOR SELECT
USING (
  auth.uid() = id
  OR public.check_is_manager_or_admin()
);

-- INSERT: Solo admins
CREATE POLICY "up_insert" ON user_profiles
FOR INSERT
WITH CHECK (public.check_is_admin());

-- UPDATE: Usuario actualiza su perfil o admin actualiza cualquiera
CREATE POLICY "up_update" ON user_profiles
FOR UPDATE
USING (
  auth.uid() = id
  OR public.check_is_admin()
)
WITH CHECK (
  auth.uid() = id
  OR public.check_is_admin()
);

-- DELETE: Solo admins
CREATE POLICY "up_delete" ON user_profiles
FOR DELETE
USING (public.check_is_admin());

-- PASO 4: VERIFICAR
SELECT 'POLITICAS CREADAS:' as info;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';

SELECT '=== FIX COMPLETADO ===' as resultado;
