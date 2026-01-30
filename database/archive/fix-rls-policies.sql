-- ================================================
-- CORREGIR POLÍTICAS RLS PARA ADMINS
-- ================================================
-- El problema: las políticas actuales no dan acceso automático a los admins

-- 1. Actualizar política de playlists para dar acceso a admins
DROP POLICY IF EXISTS "Users can view playlists they have access to" ON playlists;

CREATE POLICY "Users can view playlists they have access to"
ON playlists FOR SELECT
USING (
  -- Admins pueden ver todas las playlists
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
  OR
  -- O si la playlist es pública
  is_public = true
  OR
  -- O si tienen permisos explícitos
  id IN (
    SELECT playlist_id
    FROM playlist_permissions
    WHERE user_id = auth.uid()
  )
);

-- 2. Actualizar política de songs para dar acceso a admins
DROP POLICY IF EXISTS "Users can view songs from accessible playlists" ON songs;

CREATE POLICY "Users can view songs from accessible playlists"
ON songs FOR SELECT
USING (
  -- Admins pueden ver todas las canciones
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
  OR
  -- O si la canción está en una playlist accesible
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

-- 3. Actualizar política de playlist_songs para dar acceso a admins
DROP POLICY IF EXISTS "Users can view playlist songs they have access to" ON playlist_songs;

CREATE POLICY "Users can view playlist songs they have access to"
ON playlist_songs FOR SELECT
USING (
  -- Admins pueden ver todas las relaciones
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
  OR
  -- O si tienen acceso a la playlist
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

-- 4. Verificar que las políticas se crearon correctamente
SELECT
  tablename,
  policyname,
  cmd as "Operation"
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('playlists', 'songs', 'playlist_songs')
ORDER BY tablename, policyname;
