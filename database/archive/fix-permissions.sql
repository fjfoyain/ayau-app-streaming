-- Verificar el userId de la sesión actual vs el userId en permisos

-- 1. Ver todos los usuarios y sus IDs
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- 2. Ver permisos actuales
SELECT user_id, playlist_id, permission_level FROM playlist_permissions;

-- 3. BORRAR permisos existentes y crear con el userId correcto
DELETE FROM playlist_permissions;

-- 4. Insertar permiso con el userId correcto (el de test@ayau.com)
INSERT INTO playlist_permissions (user_id, playlist_id, permission_level)
SELECT
  u.id as user_id,
  p.id as playlist_id,
  'viewer' as permission_level
FROM auth.users u
CROSS JOIN playlists p
WHERE u.email = 'test@ayau.com' AND p.name = 'Demo Playlist';

-- 5. Verificar que se creó correctamente
SELECT
  u.email,
  u.id as user_id,
  p.name as playlist_name,
  pp.permission_level
FROM playlist_permissions pp
JOIN auth.users u ON pp.user_id = u.id
JOIN playlists p ON pp.playlist_id = p.id;
