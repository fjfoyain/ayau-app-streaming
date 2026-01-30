-- ================================================
-- DIAGNÓSTICO: Verificar acceso del usuario
-- ================================================

-- 1. Verificar el usuario autenticado actual
SELECT
  auth.uid() as "Current User ID",
  au.email as "Email"
FROM auth.users au
WHERE au.id = auth.uid();

-- 2. Verificar perfil del usuario
SELECT
  id,
  full_name,
  role,
  is_active,
  location_id
FROM user_profiles
WHERE id = auth.uid();

-- 3. Verificar permisos de playlists del usuario
SELECT
  pp.user_id,
  pp.playlist_id,
  pp.permission_level,
  p.name as playlist_name,
  p.is_public
FROM playlist_permissions pp
LEFT JOIN playlists p ON p.id = pp.playlist_id
WHERE pp.user_id = auth.uid();

-- 4. Verificar todas las playlists públicas (deberías poder verlas)
SELECT
  id,
  name,
  is_public,
  created_at
FROM playlists
WHERE is_public = true;

-- 5. Verificar si el usuario existe en user_profiles
SELECT
  au.id,
  au.email,
  up.role,
  up.is_active
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE au.email = 'test@ayau.com';
