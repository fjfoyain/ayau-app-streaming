-- ================================================
-- Playlist Assignments System
-- ================================================
-- Sistema para asignar playlists a cuentas y locales
-- ================================================

-- ================================================
-- 0. FUNCIONES HELPER
-- ================================================

-- Helper function to check if user is manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'manager'
    FROM user_profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ================================================
-- 1. TABLAS DE ASIGNACIÓN
-- ================================================

-- Playlists asignadas a cuentas (clientes)
CREATE TABLE IF NOT EXISTS public.account_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES user_profiles(id),
  UNIQUE(client_id, playlist_id)
);

-- Playlists asignadas a locales específicos (heredadas de la cuenta)
CREATE TABLE IF NOT EXISTS public.location_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES user_profiles(id),
  UNIQUE(location_id, playlist_id)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_account_playlists_client
  ON account_playlists(client_id);

CREATE INDEX IF NOT EXISTS idx_account_playlists_playlist
  ON account_playlists(playlist_id);

CREATE INDEX IF NOT EXISTS idx_location_playlists_location
  ON location_playlists(location_id);

CREATE INDEX IF NOT EXISTS idx_location_playlists_playlist
  ON location_playlists(playlist_id);

-- ================================================
-- 2. FUNCIONES DE GESTIÓN
-- ================================================

-- Asignar playlist a una cuenta
CREATE OR REPLACE FUNCTION public.assign_playlist_to_account(
  p_client_id UUID,
  p_playlist_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Verificar que el usuario es admin o manager
  IF NOT (public.is_admin() OR public.is_manager()) THEN
    RAISE EXCEPTION 'Solo admins y managers pueden asignar playlists';
  END IF;

  -- Insertar o actualizar
  INSERT INTO account_playlists (client_id, playlist_id, assigned_by)
  VALUES (p_client_id, p_playlist_id, auth.uid())
  ON CONFLICT (client_id, playlist_id)
  DO UPDATE SET
    is_active = true,
    assigned_at = NOW(),
    assigned_by = auth.uid()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover playlist de una cuenta
CREATE OR REPLACE FUNCTION public.remove_playlist_from_account(
  p_client_id UUID,
  p_playlist_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar que el usuario es admin o manager
  IF NOT (public.is_admin() OR public.is_manager()) THEN
    RAISE EXCEPTION 'Solo admins y managers pueden remover playlists';
  END IF;

  -- Eliminar la asignación
  DELETE FROM account_playlists
  WHERE client_id = p_client_id AND playlist_id = p_playlist_id;

  -- También eliminar de todos los locales de esa cuenta
  DELETE FROM location_playlists lp
  USING locations l
  WHERE lp.location_id = l.id
    AND l.client_id = p_client_id
    AND lp.playlist_id = p_playlist_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asignar playlist a un local (debe estar asignada a la cuenta primero)
CREATE OR REPLACE FUNCTION public.assign_playlist_to_location(
  p_location_id UUID,
  p_playlist_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_client_id UUID;
  v_playlist_in_account BOOLEAN;
BEGIN
  -- Verificar que el usuario es admin, manager, o usuario de la cuenta
  IF NOT (public.is_admin() OR public.is_manager()) THEN
    RAISE EXCEPTION 'Solo admins y managers pueden asignar playlists a locales';
  END IF;

  -- Obtener el client_id del local
  SELECT client_id INTO v_client_id
  FROM locations
  WHERE id = p_location_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Local no encontrado';
  END IF;

  -- Verificar que la playlist está asignada a la cuenta
  SELECT EXISTS (
    SELECT 1 FROM account_playlists
    WHERE client_id = v_client_id
      AND playlist_id = p_playlist_id
      AND is_active = true
  ) INTO v_playlist_in_account;

  IF NOT v_playlist_in_account THEN
    RAISE EXCEPTION 'Esta playlist no está asignada a la cuenta del local';
  END IF;

  -- Insertar o actualizar
  INSERT INTO location_playlists (location_id, playlist_id, assigned_by)
  VALUES (p_location_id, p_playlist_id, auth.uid())
  ON CONFLICT (location_id, playlist_id)
  DO UPDATE SET
    is_active = true,
    assigned_at = NOW(),
    assigned_by = auth.uid()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover playlist de un local
CREATE OR REPLACE FUNCTION public.remove_playlist_from_location(
  p_location_id UUID,
  p_playlist_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar que el usuario es admin, manager, o usuario de la cuenta
  IF NOT (public.is_admin() OR public.is_manager()) THEN
    RAISE EXCEPTION 'Solo admins y managers pueden remover playlists de locales';
  END IF;

  -- Eliminar la asignación
  DELETE FROM location_playlists
  WHERE location_id = p_location_id AND playlist_id = p_playlist_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtener playlists de una cuenta
CREATE OR REPLACE FUNCTION public.get_account_playlists(p_client_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN,
  song_count BIGINT,
  assigned_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.cover_image_url,
    p.is_public,
    (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) as song_count,
    ap.assigned_at
  FROM playlists p
  INNER JOIN account_playlists ap ON p.id = ap.playlist_id
  WHERE ap.client_id = p_client_id
    AND ap.is_active = true
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtener playlists de un local
CREATE OR REPLACE FUNCTION public.get_location_playlists(p_location_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN,
  song_count BIGINT,
  assigned_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.cover_image_url,
    p.is_public,
    (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) as song_count,
    lp.assigned_at
  FROM playlists p
  INNER JOIN location_playlists lp ON p.id = lp.playlist_id
  WHERE lp.location_id = p_location_id
    AND lp.is_active = true
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtener playlists disponibles para un local (las de su cuenta que no están asignadas)
CREATE OR REPLACE FUNCTION public.get_available_playlists_for_location(p_location_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN,
  song_count BIGINT
) AS $$
DECLARE
  v_client_id UUID;
BEGIN
  -- Obtener el client_id del local
  SELECT client_id INTO v_client_id
  FROM locations
  WHERE id = p_location_id;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.cover_image_url,
    p.is_public,
    (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) as song_count
  FROM playlists p
  INNER JOIN account_playlists ap ON p.id = ap.playlist_id
  WHERE ap.client_id = v_client_id
    AND ap.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM location_playlists lp
      WHERE lp.location_id = p_location_id
        AND lp.playlist_id = p.id
        AND lp.is_active = true
    )
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 3. RLS POLICIES
-- ================================================

ALTER TABLE account_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_playlists ENABLE ROW LEVEL SECURITY;

-- Admin y manager pueden ver/gestionar todas las asignaciones
CREATE POLICY "admin_manager_all_account_playlists" ON account_playlists
  FOR ALL USING (public.is_admin() OR public.is_manager());

CREATE POLICY "admin_manager_all_location_playlists" ON location_playlists
  FOR ALL USING (public.is_admin() OR public.is_manager());

-- Usuarios de cuenta pueden ver las playlists de su cuenta
CREATE POLICY "users_view_own_account_playlists" ON account_playlists
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Usuarios de local pueden ver las playlists de su local
CREATE POLICY "users_view_own_location_playlists" ON location_playlists
  FOR SELECT USING (
    location_id IN (
      SELECT location_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ================================================
-- 4. VISTAS ÚTILES
-- ================================================

-- Vista: Cuentas con sus playlists asignadas
CREATE OR REPLACE VIEW public.accounts_with_playlists AS
SELECT
  c.id as client_id,
  c.name as client_name,
  COUNT(DISTINCT ap.playlist_id) as playlist_count,
  json_agg(
    json_build_object(
      'playlist_id', p.id,
      'playlist_name', p.name,
      'assigned_at', ap.assigned_at,
      'is_active', ap.is_active
    )
  ) FILTER (WHERE p.id IS NOT NULL) as playlists
FROM clients c
LEFT JOIN account_playlists ap ON c.id = ap.client_id AND ap.is_active = true
LEFT JOIN playlists p ON ap.playlist_id = p.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- Vista: Locales con sus playlists asignadas
CREATE OR REPLACE VIEW public.locations_with_playlists AS
SELECT
  l.id as location_id,
  l.name as location_name,
  l.client_id,
  c.name as client_name,
  COUNT(DISTINCT lp.playlist_id) as playlist_count,
  json_agg(
    json_build_object(
      'playlist_id', p.id,
      'playlist_name', p.name,
      'assigned_at', lp.assigned_at,
      'is_active', lp.is_active
    )
  ) FILTER (WHERE p.id IS NOT NULL) as playlists
FROM locations l
LEFT JOIN clients c ON l.client_id = c.id
LEFT JOIN location_playlists lp ON l.id = lp.location_id AND lp.is_active = true
LEFT JOIN playlists p ON lp.playlist_id = p.id
GROUP BY l.id, l.name, l.client_id, c.name
ORDER BY c.name, l.name;

-- ================================================
-- VERIFICACIÓN
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '=== Playlist Assignment System Created ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables:';
  RAISE NOTICE '  - account_playlists (playlists por cuenta)';
  RAISE NOTICE '  - location_playlists (playlists por local)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions:';
  RAISE NOTICE '  - assign_playlist_to_account()';
  RAISE NOTICE '  - remove_playlist_from_account()';
  RAISE NOTICE '  - assign_playlist_to_location()';
  RAISE NOTICE '  - remove_playlist_from_location()';
  RAISE NOTICE '  - get_account_playlists()';
  RAISE NOTICE '  - get_location_playlists()';
  RAISE NOTICE '  - get_available_playlists_for_location()';
  RAISE NOTICE '';
  RAISE NOTICE 'Views:';
  RAISE NOTICE '  - accounts_with_playlists';
  RAISE NOTICE '  - locations_with_playlists';
END $$;
