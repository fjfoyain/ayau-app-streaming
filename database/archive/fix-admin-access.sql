-- ================================================
-- SOLUCIÓN: Restaurar acceso de admin
-- ================================================

-- 1. Asegurar que el perfil de admin existe
INSERT INTO user_profiles (id, full_name, role, is_active)
SELECT
  id,
  'Admin AYAU',
  'admin',
  true
FROM auth.users
WHERE email = 'test@ayau.com'
ON CONFLICT (id) DO UPDATE
SET
  role = 'admin',
  is_active = true,
  updated_at = NOW();

-- 2. Hacer todas las playlists públicas temporalmente para verificar
UPDATE playlists
SET is_public = true;

-- 3. Asegurar que el admin tiene permisos explícitos en todas las playlists
INSERT INTO playlist_permissions (user_id, playlist_id, permission_level)
SELECT
  au.id,
  p.id,
  'admin'
FROM auth.users au
CROSS JOIN playlists p
WHERE au.email = 'test@ayau.com'
ON CONFLICT (user_id, playlist_id) DO UPDATE
SET permission_level = 'admin';

-- 4. Verificación final - Perfil de usuario
SELECT
  'User Profile' as check_type,
  up.full_name,
  up.role::text,
  up.is_active::text as status
FROM auth.users au
JOIN user_profiles up ON au.id = up.id
WHERE au.email = 'test@ayau.com';

-- 5. Verificación final - Permisos de playlists
SELECT
  'Playlist Permissions' as info,
  COUNT(*) as total_playlists
FROM playlist_permissions pp
JOIN auth.users au ON pp.user_id = au.id
WHERE au.email = 'test@ayau.com';
