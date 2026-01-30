-- Desactivar Row Level Security (RLS) en las tablas principales
-- IMPORTANTE: Esto es solo para desarrollo/testing
-- En producción deberías crear policies adecuadas

-- Desactivar RLS en todas las tablas
ALTER TABLE playlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE songs DISABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs DISABLE ROW LEVEL SECURITY;
ALTER TABLE play_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE playback_sessions DISABLE ROW LEVEL SECURITY;

-- Verificar el estado de RLS
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
