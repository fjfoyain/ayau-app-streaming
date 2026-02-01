-- ================================================
-- REPARACIÓN COMPLETA DE RLS - TODAS LAS TABLAS
-- ================================================
-- Ejecuta este script completo en el SQL Editor de Supabase
-- Incluye: user_profiles, clients, locations, playlists, songs, play_history

-- ================================================
-- PASO 1: RECREAR FUNCIONES HELPER (SECURITY DEFINER)
-- ================================================

-- Función is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  );
$$;

-- Función is_manager_or_admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
    AND is_active = true
  );
$$;

-- Función user_has_client_access
CREATE OR REPLACE FUNCTION public.user_has_client_access(target_client_id UUID)
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
    AND is_active = true
    AND (
      role IN ('admin', 'manager')
      OR (access_level = 'account' AND client_id = target_client_id)
      OR (access_level = 'location' AND location_id IN (
        SELECT id FROM locations WHERE client_id = target_client_id
      ))
    )
  );
$$;

-- Función user_has_location_access
CREATE OR REPLACE FUNCTION public.user_has_location_access(target_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.is_active = true
    AND (
      up.role IN ('admin', 'manager')
      OR (up.access_level = 'account' AND EXISTS (
        SELECT 1 FROM locations l
        WHERE l.id = target_location_id
        AND l.client_id = up.client_id
      ))
      OR (up.access_level = 'location' AND up.location_id = target_location_id)
    )
  );
$$;

SELECT '=== FUNCIONES HELPER CREADAS ===' as info;

-- ================================================
-- PASO 2: LIMPIAR TODAS LAS POLÍTICAS EXISTENTES
-- ================================================

-- user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for users" ON user_profiles;
DROP POLICY IF EXISTS "Enable update for users" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for admins" ON user_profiles;
DROP POLICY IF EXISTS "Enable delete for admins" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their scope" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;

-- clients
DROP POLICY IF EXISTS "Users can view their client" ON clients;
DROP POLICY IF EXISTS "Managers can manage clients" ON clients;
DROP POLICY IF EXISTS "Admins and managers can manage clients" ON clients;
DROP POLICY IF EXISTS "clients_select_policy" ON clients;
DROP POLICY IF EXISTS "clients_select" ON clients;
DROP POLICY IF EXISTS "clients_manage" ON clients;

-- locations
DROP POLICY IF EXISTS "Users can view accessible locations" ON locations;
DROP POLICY IF EXISTS "Managers can manage locations" ON locations;
DROP POLICY IF EXISTS "Admins and managers can manage locations" ON locations;
DROP POLICY IF EXISTS "locations_select_policy" ON locations;
DROP POLICY IF EXISTS "locations_select" ON locations;
DROP POLICY IF EXISTS "locations_manage" ON locations;

-- playlists
DROP POLICY IF EXISTS "Public playlists viewable by everyone" ON playlists;
DROP POLICY IF EXISTS "Only admins can manage playlists" ON playlists;
DROP POLICY IF EXISTS "Managers can view all playlists" ON playlists;
DROP POLICY IF EXISTS "Managers can create playlists" ON playlists;
DROP POLICY IF EXISTS "Managers can update playlists" ON playlists;
DROP POLICY IF EXISTS "Only admins can delete playlists" ON playlists;
DROP POLICY IF EXISTS "Users can view playlists they have access to" ON playlists;
DROP POLICY IF EXISTS "Users can view accessible playlists" ON playlists;
DROP POLICY IF EXISTS "Only admins can insert playlists" ON playlists;
DROP POLICY IF EXISTS "Only admins can update playlists" ON playlists;
DROP POLICY IF EXISTS "playlists_select" ON playlists;
DROP POLICY IF EXISTS "playlists_manage" ON playlists;

-- songs
DROP POLICY IF EXISTS "Songs viewable by everyone" ON songs;
DROP POLICY IF EXISTS "Users can view songs from accessible playlists" ON songs;
DROP POLICY IF EXISTS "Only admins can manage songs" ON songs;
DROP POLICY IF EXISTS "songs_select" ON songs;
DROP POLICY IF EXISTS "songs_manage" ON songs;

-- playlist_songs
DROP POLICY IF EXISTS "Playlist songs viewable by everyone" ON playlist_songs;
DROP POLICY IF EXISTS "Managers can add songs to playlists" ON playlist_songs;
DROP POLICY IF EXISTS "Managers can update playlist songs" ON playlist_songs;
DROP POLICY IF EXISTS "Managers can remove songs from playlists" ON playlist_songs;
DROP POLICY IF EXISTS "playlist_songs_select" ON playlist_songs;
DROP POLICY IF EXISTS "playlist_songs_manage" ON playlist_songs;

-- play_history
DROP POLICY IF EXISTS "Users can view their play history" ON play_history;
DROP POLICY IF EXISTS "Users can view play history for their access scope" ON play_history;
DROP POLICY IF EXISTS "Users can insert own play history" ON play_history;
DROP POLICY IF EXISTS "play_history_select" ON play_history;
DROP POLICY IF EXISTS "play_history_insert" ON play_history;

-- playlist_permissions
DROP POLICY IF EXISTS "Users can view their playlist permissions" ON playlist_permissions;
DROP POLICY IF EXISTS "Admins can manage playlist permissions" ON playlist_permissions;
DROP POLICY IF EXISTS "playlist_permissions_select" ON playlist_permissions;
DROP POLICY IF EXISTS "playlist_permissions_manage" ON playlist_permissions;

SELECT '=== POLÍTICAS ANTERIORES ELIMINADAS ===' as info;

-- ================================================
-- PASO 3: HABILITAR RLS EN TODAS LAS TABLAS
-- ================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_permissions ENABLE ROW LEVEL SECURITY;

SELECT '=== RLS HABILITADO ===' as info;

-- ================================================
-- PASO 4: CREAR POLÍTICAS - USER_PROFILES
-- ================================================

CREATE POLICY "user_profiles_select" ON user_profiles
FOR SELECT USING (
  auth.uid() = id OR public.is_manager_or_admin()
);

CREATE POLICY "user_profiles_insert" ON user_profiles
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "user_profiles_delete" ON user_profiles
FOR DELETE USING (public.is_admin());

-- ================================================
-- PASO 5: CREAR POLÍTICAS - CLIENTS
-- ================================================

CREATE POLICY "clients_select" ON clients
FOR SELECT USING (public.user_has_client_access(id));

CREATE POLICY "clients_insert" ON clients
FOR INSERT WITH CHECK (public.is_manager_or_admin());

CREATE POLICY "clients_update" ON clients
FOR UPDATE USING (public.is_manager_or_admin());

CREATE POLICY "clients_delete" ON clients
FOR DELETE USING (public.is_manager_or_admin());

-- ================================================
-- PASO 6: CREAR POLÍTICAS - LOCATIONS
-- ================================================

CREATE POLICY "locations_select" ON locations
FOR SELECT USING (public.user_has_location_access(id));

CREATE POLICY "locations_insert" ON locations
FOR INSERT WITH CHECK (public.is_manager_or_admin());

CREATE POLICY "locations_update" ON locations
FOR UPDATE USING (public.is_manager_or_admin());

CREATE POLICY "locations_delete" ON locations
FOR DELETE USING (public.is_manager_or_admin());

-- ================================================
-- PASO 7: CREAR POLÍTICAS - PLAYLISTS
-- ================================================

-- Todos pueden ver playlists públicas, admins/managers ven todas
CREATE POLICY "playlists_select" ON playlists
FOR SELECT USING (
  is_public = true
  OR public.is_manager_or_admin()
  OR id IN (
    SELECT playlist_id FROM playlist_permissions WHERE user_id = auth.uid()
  )
);

CREATE POLICY "playlists_insert" ON playlists
FOR INSERT WITH CHECK (public.is_manager_or_admin());

CREATE POLICY "playlists_update" ON playlists
FOR UPDATE USING (public.is_manager_or_admin());

CREATE POLICY "playlists_delete" ON playlists
FOR DELETE USING (public.is_admin());

-- ================================================
-- PASO 8: CREAR POLÍTICAS - SONGS
-- ================================================

-- Todos pueden ver canciones
CREATE POLICY "songs_select" ON songs
FOR SELECT USING (true);

CREATE POLICY "songs_insert" ON songs
FOR INSERT WITH CHECK (public.is_manager_or_admin());

CREATE POLICY "songs_update" ON songs
FOR UPDATE USING (public.is_manager_or_admin());

CREATE POLICY "songs_delete" ON songs
FOR DELETE USING (public.is_admin());

-- ================================================
-- PASO 9: CREAR POLÍTICAS - PLAYLIST_SONGS
-- ================================================

CREATE POLICY "playlist_songs_select" ON playlist_songs
FOR SELECT USING (true);

CREATE POLICY "playlist_songs_insert" ON playlist_songs
FOR INSERT WITH CHECK (public.is_manager_or_admin());

CREATE POLICY "playlist_songs_update" ON playlist_songs
FOR UPDATE USING (public.is_manager_or_admin());

CREATE POLICY "playlist_songs_delete" ON playlist_songs
FOR DELETE USING (public.is_manager_or_admin());

-- ================================================
-- PASO 10: CREAR POLÍTICAS - PLAY_HISTORY
-- ================================================

CREATE POLICY "play_history_select" ON play_history
FOR SELECT USING (
  auth.uid() = user_id
  OR public.is_manager_or_admin()
  OR (client_id IS NOT NULL AND public.user_has_client_access(client_id))
  OR (location_id IS NOT NULL AND public.user_has_location_access(location_id))
);

CREATE POLICY "play_history_insert" ON play_history
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ================================================
-- PASO 11: CREAR POLÍTICAS - PLAYLIST_PERMISSIONS
-- ================================================

CREATE POLICY "playlist_permissions_select" ON playlist_permissions
FOR SELECT USING (
  user_id = auth.uid() OR public.is_manager_or_admin()
);

CREATE POLICY "playlist_permissions_insert" ON playlist_permissions
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "playlist_permissions_delete" ON playlist_permissions
FOR DELETE USING (public.is_admin());

SELECT '=== TODAS LAS POLÍTICAS CREADAS ===' as info;

-- ================================================
-- PASO 12: ASEGURAR ADMIN TIENE ACCESO
-- ================================================

UPDATE user_profiles
SET access_level = NULL, is_active = true
WHERE role IN ('admin', 'manager');

-- ================================================
-- PASO 13: VERIFICACIÓN
-- ================================================

SELECT '=== VERIFICACIÓN: USUARIOS ADMIN ===' as info;

SELECT
  id,
  email,
  role,
  access_level,
  is_active
FROM user_profiles
WHERE role IN ('admin', 'manager');

SELECT '=== VERIFICACIÓN: TODAS LAS POLÍTICAS ===' as info;

SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'clients', 'locations', 'playlists', 'songs', 'playlist_songs', 'play_history', 'playlist_permissions')
ORDER BY tablename, policyname;

SELECT '=== PRUEBA: CONTAR DATOS ===' as info;

SELECT
  (SELECT COUNT(*) FROM clients) as total_clients,
  (SELECT COUNT(*) FROM locations) as total_locations,
  (SELECT COUNT(*) FROM playlists) as total_playlists,
  (SELECT COUNT(*) FROM songs) as total_songs;

SELECT '=== ¡REPARACIÓN COMPLETADA! ===' as status;
