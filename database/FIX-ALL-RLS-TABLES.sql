-- ================================================
-- FIX COMPLETO DE RLS - TODAS LAS TABLAS
-- ================================================
-- Este script arregla RLS en TODAS las tablas necesarias
-- para que analytics y la app funcionen correctamente
-- ================================================

-- ================================================
-- PASO 1: FUNCIONES HELPER (si no existen)
-- ================================================

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_is_active BOOLEAN;
BEGIN
  SELECT role, is_active INTO v_role, v_is_active
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN v_role = 'admin' AND COALESCE(v_is_active, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_is_active BOOLEAN;
BEGIN
  SELECT role, is_active INTO v_role, v_is_active
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN v_role IN ('admin', 'manager') AND COALESCE(v_is_active, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_client_access(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_access_level TEXT;
  v_client_id UUID;
  v_location_id UUID;
  v_is_active BOOLEAN;
BEGIN
  SELECT role, access_level, client_id, location_id, is_active
  INTO v_role, v_access_level, v_client_id, v_location_id, v_is_active
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_active, true) THEN
    RETURN false;
  END IF;

  -- Admins y managers tienen acceso a todo
  IF v_role IN ('admin', 'manager') THEN
    RETURN true;
  END IF;

  -- Usuarios con acceso a cuenta específica
  IF v_access_level = 'account' AND v_client_id = target_client_id THEN
    RETURN true;
  END IF;

  -- Usuarios con acceso a location de ese cliente
  IF v_access_level = 'location' AND v_location_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM locations
      WHERE id = v_location_id AND client_id = target_client_id
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_location_access(target_location_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
  v_access_level TEXT;
  v_client_id UUID;
  v_location_id UUID;
  v_is_active BOOLEAN;
  v_target_client_id UUID;
BEGIN
  SELECT role, access_level, client_id, location_id, is_active
  INTO v_role, v_access_level, v_client_id, v_location_id, v_is_active
  FROM user_profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_active, true) THEN
    RETURN false;
  END IF;

  -- Admins y managers tienen acceso a todo
  IF v_role IN ('admin', 'manager') THEN
    RETURN true;
  END IF;

  -- Usuarios con acceso directo a esa location
  IF v_access_level = 'location' AND v_location_id = target_location_id THEN
    RETURN true;
  END IF;

  -- Usuarios con acceso a cuenta (tienen acceso a todas las locations de esa cuenta)
  IF v_access_level = 'account' AND v_client_id IS NOT NULL THEN
    SELECT client_id INTO v_target_client_id FROM locations WHERE id = target_location_id;
    RETURN v_client_id = v_target_client_id;
  END IF;

  RETURN false;
END;
$$;

SELECT '=== FUNCIONES HELPER CREADAS ===' as paso;

-- ================================================
-- PASO 2: LIMPIAR TODAS LAS POLITICAS DE TODAS LAS TABLAS
-- ================================================

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['user_profiles', 'clients', 'locations', 'playlists', 'songs', 'playlist_songs', 'play_history', 'playlist_permissions'])
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

SELECT '=== POLITICAS ELIMINADAS ===' as paso;

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

SELECT '=== RLS HABILITADO ===' as paso;

-- ================================================
-- PASO 4: POLITICAS PARA user_profiles
-- ================================================

CREATE POLICY "up_select" ON user_profiles FOR SELECT
USING (auth.uid() = id OR public.check_is_manager_or_admin());

CREATE POLICY "up_insert" ON user_profiles FOR INSERT
WITH CHECK (public.check_is_admin());

CREATE POLICY "up_update" ON user_profiles FOR UPDATE
USING (auth.uid() = id OR public.check_is_admin())
WITH CHECK (auth.uid() = id OR public.check_is_admin());

CREATE POLICY "up_delete" ON user_profiles FOR DELETE
USING (public.check_is_admin());

-- ================================================
-- PASO 5: POLITICAS PARA clients
-- ================================================

CREATE POLICY "clients_select" ON clients FOR SELECT
USING (public.check_is_manager_or_admin() OR public.check_user_client_access(id));

CREATE POLICY "clients_insert" ON clients FOR INSERT
WITH CHECK (public.check_is_manager_or_admin());

CREATE POLICY "clients_update" ON clients FOR UPDATE
USING (public.check_is_manager_or_admin());

CREATE POLICY "clients_delete" ON clients FOR DELETE
USING (public.check_is_admin());

-- ================================================
-- PASO 6: POLITICAS PARA locations
-- ================================================

CREATE POLICY "locations_select" ON locations FOR SELECT
USING (public.check_is_manager_or_admin() OR public.check_user_location_access(id));

CREATE POLICY "locations_insert" ON locations FOR INSERT
WITH CHECK (public.check_is_manager_or_admin());

CREATE POLICY "locations_update" ON locations FOR UPDATE
USING (public.check_is_manager_or_admin());

CREATE POLICY "locations_delete" ON locations FOR DELETE
USING (public.check_is_admin());

-- ================================================
-- PASO 7: POLITICAS PARA playlists
-- ================================================

CREATE POLICY "playlists_select" ON playlists FOR SELECT
USING (
  is_public = true
  OR public.check_is_manager_or_admin()
  OR id IN (SELECT playlist_id FROM playlist_permissions WHERE user_id = auth.uid())
);

CREATE POLICY "playlists_insert" ON playlists FOR INSERT
WITH CHECK (public.check_is_manager_or_admin());

CREATE POLICY "playlists_update" ON playlists FOR UPDATE
USING (public.check_is_manager_or_admin());

CREATE POLICY "playlists_delete" ON playlists FOR DELETE
USING (public.check_is_admin());

-- ================================================
-- PASO 8: POLITICAS PARA songs (todos pueden ver)
-- ================================================

CREATE POLICY "songs_select" ON songs FOR SELECT
USING (true);

CREATE POLICY "songs_insert" ON songs FOR INSERT
WITH CHECK (public.check_is_manager_or_admin());

CREATE POLICY "songs_update" ON songs FOR UPDATE
USING (public.check_is_manager_or_admin());

CREATE POLICY "songs_delete" ON songs FOR DELETE
USING (public.check_is_admin());

-- ================================================
-- PASO 9: POLITICAS PARA playlist_songs (todos pueden ver)
-- ================================================

CREATE POLICY "playlist_songs_select" ON playlist_songs FOR SELECT
USING (true);

CREATE POLICY "playlist_songs_insert" ON playlist_songs FOR INSERT
WITH CHECK (public.check_is_manager_or_admin());

CREATE POLICY "playlist_songs_update" ON playlist_songs FOR UPDATE
USING (public.check_is_manager_or_admin());

CREATE POLICY "playlist_songs_delete" ON playlist_songs FOR DELETE
USING (public.check_is_manager_or_admin());

-- ================================================
-- PASO 10: POLITICAS PARA play_history
-- ================================================

CREATE POLICY "play_history_select" ON play_history FOR SELECT
USING (
  auth.uid() = user_id
  OR public.check_is_manager_or_admin()
);

CREATE POLICY "play_history_insert" ON play_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ================================================
-- PASO 11: POLITICAS PARA playlist_permissions
-- ================================================

CREATE POLICY "playlist_permissions_select" ON playlist_permissions FOR SELECT
USING (user_id = auth.uid() OR public.check_is_manager_or_admin());

CREATE POLICY "playlist_permissions_insert" ON playlist_permissions FOR INSERT
WITH CHECK (public.check_is_admin());

CREATE POLICY "playlist_permissions_delete" ON playlist_permissions FOR DELETE
USING (public.check_is_admin());

SELECT '=== POLITICAS CREADAS ===' as paso;

-- ================================================
-- PASO 12: ASEGURAR QUE ADMINS TIENEN is_active = true
-- ================================================

UPDATE user_profiles
SET is_active = true
WHERE role IN ('admin', 'manager') AND is_active IS NULL;

-- ================================================
-- VERIFICACION FINAL
-- ================================================

SELECT '=== VERIFICACION FINAL ===' as paso;

SELECT tablename, COUNT(*) as num_policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'clients', 'locations', 'playlists', 'songs', 'playlist_songs', 'play_history', 'playlist_permissions')
GROUP BY tablename
ORDER BY tablename;

SELECT '=== FIX COMPLETO ===' as resultado;
