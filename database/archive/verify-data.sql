-- Verificar datos de prueba

-- 1. Ver el usuario más reciente
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- 2. Ver playlists
SELECT id, name, description FROM playlists;

-- 3. Ver permisos del usuario
SELECT
  u.email,
  p.name as playlist_name,
  pp.permission_level,
  pp.granted_at
FROM playlist_permissions pp
JOIN auth.users u ON pp.user_id = u.id
JOIN playlists p ON pp.playlist_id = p.id
ORDER BY pp.granted_at DESC;

-- 4. Ver canciones
SELECT id, title, performer, duration FROM songs LIMIT 10;

-- 5. Ver canciones en playlists
SELECT
  p.name as playlist_name,
  s.title as song_title,
  ps.position
FROM playlist_songs ps
JOIN playlists p ON ps.playlist_id = p.id
JOIN songs s ON ps.song_id = s.id
ORDER BY p.name, ps.position;
