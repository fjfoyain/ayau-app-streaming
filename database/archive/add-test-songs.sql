-- Script para agregar canciones de prueba a la playlist demo
-- Ejecuta esto en el SQL Editor de Supabase

-- Insertar algunas canciones de prueba con URLs de audio públicas
INSERT INTO songs (title, author, performer, duration, file_url, isrc)
VALUES
  ('Canción de Prueba 1', 'Compositor 1', 'Artista 1', 180, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'TEST00000001'),
  ('Canción de Prueba 2', 'Compositor 2', 'Artista 2', 200, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'TEST00000002'),
  ('Canción de Prueba 3', 'Compositor 3', 'Artista 3', 220, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'TEST00000003')
ON CONFLICT DO NOTHING;

-- Agregar las canciones a la playlist demo
INSERT INTO playlist_songs (playlist_id, song_id, position)
SELECT
  (SELECT id FROM playlists WHERE name = 'Demo Playlist'),
  s.id,
  ROW_NUMBER() OVER (ORDER BY s.created_at) - 1
FROM songs s
WHERE s.isrc LIKE 'TEST%'
ON CONFLICT (playlist_id, song_id) DO NOTHING;

-- Verificar que se agregaron correctamente
SELECT
  p.name as playlist_name,
  s.title,
  s.performer,
  s.duration,
  ps.position
FROM playlist_songs ps
JOIN playlists p ON ps.playlist_id = p.id
JOIN songs s ON ps.song_id = s.id
WHERE p.name = 'Demo Playlist'
ORDER BY ps.position;
