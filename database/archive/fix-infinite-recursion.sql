-- ================================================
-- SOLUCIÓN: Eliminar recursión infinita en políticas RLS
-- ================================================

-- PASO 1: Crear función auxiliar que evite RLS para verificar roles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  );
$$;

-- PASO 2: Eliminar las políticas problemáticas de user_profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;

-- PASO 3: Recrear política simple de user_profiles sin recursión
CREATE POLICY "Users can view their own profile"
ON user_profiles FOR SELECT
USING (id = auth.uid());

-- Los admins pueden ver su propio perfil con la política anterior
-- No necesitamos una política especial para que admins vean todos los perfiles

-- PASO 4: Actualizar políticas de playlists para usar la función is_admin()
DROP POLICY IF EXISTS "Users can view playlists they have access to" ON playlists;

CREATE POLICY "Users can view playlists they have access to"
ON playlists FOR SELECT
USING (
  -- Admins pueden ver todas las playlists (usando función sin RLS)
  public.is_admin()
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

-- PASO 5: Actualizar política de songs
DROP POLICY IF EXISTS "Users can view songs from accessible playlists" ON songs;

CREATE POLICY "Users can view songs from accessible playlists"
ON songs FOR SELECT
USING (
  -- Admins pueden ver todas las canciones (usando función sin RLS)
  public.is_admin()
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

-- PASO 6: Actualizar política de playlist_songs
DROP POLICY IF EXISTS "Users can view playlist songs they have access to" ON playlist_songs;

CREATE POLICY "Users can view playlist songs they have access to"
ON playlist_songs FOR SELECT
USING (
  -- Admins pueden ver todas las relaciones (usando función sin RLS)
  public.is_admin()
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

-- PASO 7: Actualizar las demás políticas que verifican admin
DROP POLICY IF EXISTS "Only admins can manage songs" ON songs;

CREATE POLICY "Only admins can manage songs"
ON songs FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins can manage playlist songs" ON playlist_songs;

CREATE POLICY "Only admins can manage playlist songs"
ON playlist_songs FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins can manage permissions" ON playlist_permissions;

CREATE POLICY "Only admins can manage permissions"
ON playlist_permissions FOR ALL
USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins can insert playlists" ON playlists;

CREATE POLICY "Only admins can insert playlists"
ON playlists FOR INSERT
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can update playlists" ON playlists;

CREATE POLICY "Only admins can update playlists"
ON playlists FOR UPDATE
USING (public.is_admin());

-- PASO 8: Verificación
SELECT 'RLS Policies Updated Successfully' as status;

SELECT
  tablename,
  policyname,
  cmd as "Operation"
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('playlists', 'songs', 'playlist_songs', 'user_profiles')
ORDER BY tablename, policyname;
