-- Script para asignar la playlist demo al usuario más reciente
-- Ejecuta esto en el SQL Editor de Supabase

-- Asignar playlist demo al usuario más reciente
INSERT INTO playlist_permissions (user_id, playlist_id, permission_level)
SELECT
  (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1) as user_id,
  p.id as playlist_id,
  'viewer' as permission_level
FROM playlists p
WHERE p.name = 'Demo Playlist'
ON CONFLICT (user_id, playlist_id) DO UPDATE
SET permission_level = 'viewer';

-- Verificar que se creó correctamente
SELECT
  u.email,
  p.name as playlist_name,
  pp.permission_level
FROM playlist_permissions pp
JOIN auth.users u ON pp.user_id = u.id
JOIN playlists p ON pp.playlist_id = p.id
ORDER BY pp.granted_at DESC
LIMIT 5;
