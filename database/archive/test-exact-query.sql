-- Probar el query exacto que está usando el frontend

-- Este es el query que getUserPlaylists está ejecutando
SELECT
  pp.playlist_id,
  pp.permission_level,
  p.id,
  p.name,
  p.description,
  p.cover_image_url,
  p.is_public,
  p.created_at,
  p.updated_at
FROM playlist_permissions pp
LEFT JOIN playlists p ON pp.playlist_id = p.id
WHERE pp.user_id = '2d78246a-eefa-4575-aeae-f1a7a01dbc47';

-- También verificar que el permiso existe
SELECT * FROM playlist_permissions
WHERE user_id = '2d78246a-eefa-4575-aeae-f1a7a01dbc47';

-- Ver qué playlists existen
SELECT * FROM playlists;
