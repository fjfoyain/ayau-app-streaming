-- ================================================
-- DIAGNÓSTICO Y CORRECCIÓN DE USUARIOS
-- ================================================

-- PASO 1: Ver todos los usuarios en auth (sin RLS)
SELECT 'Usuarios en auth.users:' as info;
SELECT id, email, created_at, raw_user_meta_data->>'role' as metadata_role
FROM auth.users
ORDER BY created_at DESC;

-- PASO 2: Ver todos los perfiles (sin RLS - usando bypass)
SELECT '---' as separator;
SELECT 'Perfiles en user_profiles:' as info;
SELECT id, full_name, role, is_active, created_at
FROM user_profiles
ORDER BY created_at DESC;

-- PASO 3: Ver políticas actuales
SELECT '---' as separator;
SELECT 'Políticas actuales en user_profiles:' as info;
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- PASO 4: Verificar que la función is_admin() existe y funciona
SELECT '---' as separator;
SELECT 'Verificando función is_admin():' as info;
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'is_admin';

-- PASO 5: Crear perfiles faltantes para usuarios que existen en auth pero no en user_profiles
SELECT '---' as separator;
SELECT 'Creando perfiles faltantes...' as info;

INSERT INTO user_profiles (id, full_name, role, is_active)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email) as full_name,
  COALESCE(au.raw_user_meta_data->>'role', 'user') as role,
  true as is_active
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- PASO 6: Eliminar TODAS las políticas existentes en user_profiles
SELECT '---' as separator;
SELECT 'Eliminando políticas existentes...' as info;

DROP POLICY IF EXISTS "Users can view user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can create user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can delete user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can insert users" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update users" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can delete users" ON user_profiles;

-- PASO 7: Crear políticas correctas y simples
SELECT '---' as separator;
SELECT 'Creando nuevas políticas...' as info;

-- Política de SELECT: Admins ven todos, otros solo su perfil
CREATE POLICY "users_select_policy"
ON user_profiles FOR SELECT
TO authenticated
USING (
  public.is_admin() = true OR id = auth.uid()
);

-- Política de INSERT: Solo admins
CREATE POLICY "users_insert_policy"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() = true);

-- Política de UPDATE: Solo admins
CREATE POLICY "users_update_policy"
ON user_profiles FOR UPDATE
TO authenticated
USING (public.is_admin() = true);

-- Política de DELETE: Solo admins
CREATE POLICY "users_delete_policy"
ON user_profiles FOR DELETE
TO authenticated
USING (public.is_admin() = true);

-- PASO 8: Verificar el resultado
SELECT '---' as separator;
SELECT 'Verificación final:' as info;
SELECT COUNT(*) as total_users_in_auth FROM auth.users;
SELECT COUNT(*) as total_profiles FROM user_profiles;
SELECT COUNT(*) as total_policies FROM pg_policies WHERE tablename = 'user_profiles';
