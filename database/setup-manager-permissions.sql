-- ================================================
-- CONFIGURAR PERMISOS PARA ROL 'MANAGER'
-- ================================================
-- Los managers pueden gestionar playlists y canciones,
-- pero NO tienen acceso a usuarios ni algunas funciones de admin

-- 1. Crear función helper para verificar si el usuario es manager o admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
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
    AND role IN ('admin', 'manager')
    AND is_active = true
  );
$$;

-- 2. POLÍTICAS PARA PLAYLISTS
-- Managers pueden ver todas las playlists
DROP POLICY IF EXISTS "Managers can view all playlists" ON playlists;
CREATE POLICY "Managers can view all playlists"
ON playlists FOR SELECT
USING (public.is_manager_or_admin());

-- Managers pueden crear playlists
DROP POLICY IF EXISTS "Managers can create playlists" ON playlists;
CREATE POLICY "Managers can create playlists"
ON playlists FOR INSERT
WITH CHECK (public.is_manager_or_admin());

-- Managers pueden editar playlists
DROP POLICY IF EXISTS "Managers can update playlists" ON playlists;
CREATE POLICY "Managers can update playlists"
ON playlists FOR UPDATE
USING (public.is_manager_or_admin());

-- Solo admins pueden eliminar playlists
DROP POLICY IF EXISTS "Only admins can delete playlists" ON playlists;
CREATE POLICY "Only admins can delete playlists"
ON playlists FOR DELETE
USING (public.is_admin());

-- 3. POLÍTICAS PARA SONGS
-- Managers pueden ver todas las canciones
DROP POLICY IF EXISTS "Managers can view all songs" ON songs;
CREATE POLICY "Managers can view all songs"
ON songs FOR SELECT
USING (public.is_manager_or_admin());

-- Managers pueden crear canciones
DROP POLICY IF EXISTS "Managers can create songs" ON songs;
CREATE POLICY "Managers can create songs"
ON songs FOR INSERT
WITH CHECK (public.is_manager_or_admin());

-- Managers pueden editar canciones
DROP POLICY IF EXISTS "Managers can update songs" ON songs;
CREATE POLICY "Managers can update songs"
ON songs FOR UPDATE
USING (public.is_manager_or_admin());

-- Managers pueden eliminar canciones
DROP POLICY IF EXISTS "Managers can delete songs" ON songs;
CREATE POLICY "Managers can delete songs"
ON songs FOR DELETE
USING (public.is_manager_or_admin());

-- 4. POLÍTICAS PARA PLAYLIST_SONGS
-- Managers pueden ver relaciones playlist-song
DROP POLICY IF EXISTS "Managers can view playlist songs" ON playlist_songs;
CREATE POLICY "Managers can view playlist songs"
ON playlist_songs FOR SELECT
USING (public.is_manager_or_admin());

-- Managers pueden agregar canciones a playlists
DROP POLICY IF EXISTS "Managers can add songs to playlists" ON playlist_songs;
CREATE POLICY "Managers can add songs to playlists"
ON playlist_songs FOR INSERT
WITH CHECK (public.is_manager_or_admin());

-- Managers pueden actualizar playlist_songs (cambiar posición, etc)
DROP POLICY IF EXISTS "Managers can update playlist songs" ON playlist_songs;
CREATE POLICY "Managers can update playlist songs"
ON playlist_songs FOR UPDATE
USING (public.is_manager_or_admin());

-- Managers pueden remover canciones de playlists
DROP POLICY IF EXISTS "Managers can remove songs from playlists" ON playlist_songs;
CREATE POLICY "Managers can remove songs from playlists"
ON playlist_songs FOR DELETE
USING (public.is_manager_or_admin());

-- 5. POLÍTICAS PARA STORAGE (canciones y covers)
-- Managers pueden subir archivos de audio
DROP POLICY IF EXISTS "Managers can upload songs" ON storage.objects;
CREATE POLICY "Managers can upload songs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'songs' AND
  (
    public.is_manager_or_admin()
  )
);

-- Managers pueden subir covers
DROP POLICY IF EXISTS "Managers can upload covers" ON storage.objects;
CREATE POLICY "Managers can upload covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'covers' AND
  (
    public.is_manager_or_admin()
  )
);

-- Solo admins pueden eliminar archivos de storage
-- (Esta política ya existe en setup-storage.sql)

-- 6. USER_PROFILES - Managers NO pueden gestionar usuarios
-- Los managers solo pueden ver su propio perfil
DROP POLICY IF EXISTS "Managers can view their own profile" ON user_profiles;
CREATE POLICY "Managers can view their own profile"
ON user_profiles FOR SELECT
USING (
  id = auth.uid() OR
  public.is_admin()
);

-- Solo admins pueden crear, editar o eliminar usuarios
DROP POLICY IF EXISTS "Only admins can insert users" ON user_profiles;
CREATE POLICY "Only admins can insert users"
ON user_profiles FOR INSERT
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can update users" ON user_profiles;
CREATE POLICY "Only admins can update users"
ON user_profiles FOR UPDATE
USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete users" ON user_profiles;
CREATE POLICY "Only admins can delete users"
ON user_profiles FOR DELETE
USING (public.is_admin());

-- 7. PLAYLIST_PERMISSIONS
-- Managers pueden gestionar permisos de playlists
DROP POLICY IF EXISTS "Managers can view playlist permissions" ON playlist_permissions;
CREATE POLICY "Managers can view playlist permissions"
ON playlist_permissions FOR SELECT
USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Managers can create playlist permissions" ON playlist_permissions;
CREATE POLICY "Managers can create playlist permissions"
ON playlist_permissions FOR INSERT
WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "Managers can delete playlist permissions" ON playlist_permissions;
CREATE POLICY "Managers can delete playlist permissions"
ON playlist_permissions FOR DELETE
USING (public.is_manager_or_admin());

-- 8. PLAY_HISTORY - Solo lectura para managers (para analytics básico)
DROP POLICY IF EXISTS "Managers can view play history" ON play_history;
CREATE POLICY "Managers can view play history"
ON play_history FOR SELECT
USING (public.is_manager_or_admin());

-- Verificar funciones creadas
SELECT proname, prosrc FROM pg_proc WHERE proname IN ('is_admin', 'is_manager_or_admin');
