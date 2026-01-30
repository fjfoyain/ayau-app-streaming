-- ================================================
-- CORREGIR POLÍTICAS RLS PARA USER_PROFILES
-- ================================================

-- El problema es que las políticas actuales impiden que los admins vean todos los usuarios
-- Necesitamos permitir que los admins vean TODOS los usuarios, no solo su propio perfil

-- 1. Eliminar políticas existentes
DROP POLICY IF EXISTS "Managers can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can insert users" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update users" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can delete users" ON user_profiles;

-- 2. Crear nuevas políticas correctas

-- Admins pueden ver TODOS los perfiles
-- Managers y usuarios solo pueden ver su propio perfil
CREATE POLICY "Users can view user profiles"
ON user_profiles FOR SELECT
USING (
  public.is_admin() OR -- Admins ven todos
  id = auth.uid()      -- Otros solo ven su propio perfil
);

-- Solo admins pueden crear usuarios
CREATE POLICY "Only admins can create user profiles"
ON user_profiles FOR INSERT
WITH CHECK (public.is_admin());

-- Solo admins pueden actualizar usuarios
CREATE POLICY "Only admins can update user profiles"
ON user_profiles FOR UPDATE
USING (public.is_admin());

-- Solo admins pueden eliminar usuarios
CREATE POLICY "Only admins can delete user profiles"
ON user_profiles FOR DELETE
USING (public.is_admin());

-- 3. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;
