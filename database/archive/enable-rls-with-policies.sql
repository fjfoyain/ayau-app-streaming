-- ================================================
-- POLÍTICAS DE ROW LEVEL SECURITY (RLS) PARA PRODUCCIÓN
-- ================================================
-- Este script configura RLS con políticas apropiadas para cada tabla

-- ================================================
-- 1. PLAYLISTS
-- ================================================
-- Los usuarios solo pueden ver playlists a las que tienen permisos

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

-- Policy: Ver playlists públicas o con permisos asignados
CREATE POLICY "Users can view playlists they have access to"
ON playlists FOR SELECT
USING (
  is_public = true OR
  id IN (
    SELECT playlist_id
    FROM playlist_permissions
    WHERE user_id = auth.uid()
  )
);

-- Policy: Solo admins pueden crear/editar playlists
CREATE POLICY "Only admins can insert playlists"
ON playlists FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can update playlists"
ON playlists FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ================================================
-- 2. PLAYLIST_PERMISSIONS
-- ================================================
-- Los usuarios pueden ver sus propios permisos, admins pueden ver todos

ALTER TABLE playlist_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own permissions"
ON playlist_permissions FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Solo admins pueden gestionar permisos
CREATE POLICY "Only admins can manage permissions"
ON playlist_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ================================================
-- 3. SONGS
-- ================================================
-- Los usuarios pueden ver canciones que están en playlists accesibles

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view songs from accessible playlists"
ON songs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM playlist_songs ps
    INNER JOIN playlists p ON ps.playlist_id = p.id
    WHERE ps.song_id = songs.id
    AND (
      p.is_public = true OR
      p.id IN (
        SELECT playlist_id
        FROM playlist_permissions
        WHERE user_id = auth.uid()
      )
    )
  )
);

-- Solo admins pueden gestionar canciones
CREATE POLICY "Only admins can manage songs"
ON songs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ================================================
-- 4. PLAYLIST_SONGS
-- ================================================
-- Relación entre playlists y canciones

ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view playlist songs they have access to"
ON playlist_songs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM playlists p
    WHERE p.id = playlist_songs.playlist_id
    AND (
      p.is_public = true OR
      p.id IN (
        SELECT playlist_id
        FROM playlist_permissions
        WHERE user_id = auth.uid()
      )
    )
  )
);

-- Solo admins pueden gestionar relaciones playlist-songs
CREATE POLICY "Only admins can manage playlist songs"
ON playlist_songs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ================================================
-- 5. PLAY_HISTORY
-- ================================================
-- Los usuarios pueden insertar y ver su propio historial

ALTER TABLE play_history ENABLE ROW LEVEL SECURITY;

-- Usuarios pueden insertar su propio historial
CREATE POLICY "Users can insert their own play history"
ON play_history FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Usuarios pueden ver su propio historial
CREATE POLICY "Users can view their own play history"
ON play_history FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admins pueden ver todo el historial
CREATE POLICY "Admins can view all play history"
ON play_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ================================================
-- 6. CLIENTS Y LOCATIONS
-- ================================================
-- Solo admins y managers pueden ver esta información

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins and managers can view clients"
ON clients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

CREATE POLICY "Only admins and managers can view locations"
ON locations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- ================================================
-- 7. USER_PROFILES
-- ================================================
-- Los usuarios pueden ver su propio perfil, admins pueden ver todos

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON user_profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON user_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ================================================
-- 8. PLAYBACK_SESSIONS
-- ================================================
-- Control de sesiones de reproducción

ALTER TABLE playback_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view playback sessions for their client"
ON playback_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    INNER JOIN locations l ON up.location_id = l.id
    WHERE up.id = auth.uid()
    AND l.client_id = playback_sessions.client_id
  )
);

CREATE POLICY "Admins and managers can manage playback sessions"
ON playback_sessions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  )
);

-- ================================================
-- 9. STREAM_ANALYTICS_MONTHLY
-- ================================================
-- Solo admins pueden ver analytics

ALTER TABLE stream_analytics_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view analytics"
ON stream_analytics_monthly FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ================================================
-- VERIFICACIÓN
-- ================================================
-- Ver el estado de RLS en todas las tablas
SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Ver todas las políticas creadas
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as "Operation"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
