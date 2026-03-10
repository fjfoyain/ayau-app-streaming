-- ============================================================
-- IDEMPOTENT MIGRATION: Account & Venue Management System
-- ============================================================
-- Safe to run multiple times. Each step checks before applying.
-- Covers:
--   1. clients: owner_id, playback_mode columns
--   2. locations: manager_id column
--   3. user_profiles: access_level, client_id columns
--   4. Indexes
--   5. Helper functions (user_has_client_access, user_has_location_access, can_control_playback)
--   6. RLS policies for clients, locations, play_history, user_profiles, playlists, playback_sessions
--   7. Analytics views (analytics_by_account, analytics_by_venue, user_access_summary)
--   8. Data migration for existing users
--   9. Verification report
-- ============================================================

DO $$ BEGIN RAISE NOTICE '=== STARTING ACCOUNT/VENUE MANAGEMENT MIGRATION ==='; END $$;

-- ============================================================
-- SECTION 1: clients table columns
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[1/9] Checking clients table columns...'; END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS playback_mode VARCHAR(20) DEFAULT 'independent';

DO $$
BEGIN
  ALTER TABLE clients
    ADD CONSTRAINT check_playback_mode
    CHECK (playback_mode IN ('independent', 'shared_playlist', 'synchronized'));
  RAISE NOTICE '  + Constraint check_playback_mode created on clients';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  - Constraint check_playback_mode already exists, skipping';
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON clients(owner_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'owner_id'
  ) THEN
    RAISE NOTICE '  ✓ clients.owner_id ready';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'playback_mode'
  ) THEN
    RAISE NOTICE '  ✓ clients.playback_mode ready';
  END IF;
END $$;

-- ============================================================
-- SECTION 2: locations table columns
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[2/9] Checking locations table columns...'; END $$;

ALTER TABLE locations ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_locations_manager_id ON locations(manager_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'manager_id'
  ) THEN
    RAISE NOTICE '  ✓ locations.manager_id ready';
  END IF;
END $$;

-- ============================================================
-- SECTION 3: user_profiles table columns
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[3/9] Checking user_profiles table columns...'; END $$;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) DEFAULT 'location';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE user_profiles
    ADD CONSTRAINT check_access_level
    CHECK (access_level IN ('account', 'location'));
  RAISE NOTICE '  + Constraint check_access_level created on user_profiles';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  - Constraint check_access_level already exists, skipping';
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_client ON user_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_access_level ON user_profiles(access_level);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'access_level'
  ) THEN
    RAISE NOTICE '  ✓ user_profiles.access_level ready';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'client_id'
  ) THEN
    RAISE NOTICE '  ✓ user_profiles.client_id ready';
  END IF;
END $$;

-- ============================================================
-- SECTION 4: Helper functions
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[4/9] Creating/updating helper functions...'; END $$;

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
    AND (
      role = 'admin'
      OR (access_level = 'account' AND client_id = target_client_id)
      OR (access_level = 'location' AND location_id IN (
        SELECT id FROM locations WHERE client_id = target_client_id
      ))
    )
    AND is_active = true
  );
$$;

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
    LEFT JOIN locations l ON up.client_id = l.client_id
    WHERE up.id = auth.uid()
    AND (
      up.role = 'admin'
      OR (up.access_level = 'account' AND l.id = target_location_id)
      OR (up.access_level = 'location' AND up.location_id = target_location_id)
    )
    AND up.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_control_playback(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_owner BOOLEAN;
  v_is_account_manager BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;

  SELECT EXISTS(
    SELECT 1 FROM clients WHERE id = p_client_id AND owner_id = v_user_id
  ) INTO v_is_owner;
  IF v_is_owner THEN RETURN TRUE; END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = v_user_id
    AND client_id = p_client_id
    AND access_level = 'account'
    AND role IN ('manager', 'admin')
    AND is_active = true
  ) INTO v_is_account_manager;

  RETURN v_is_account_manager;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_client_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_location_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_control_playback TO authenticated;

DO $$ BEGIN RAISE NOTICE '  ✓ Functions user_has_client_access, user_has_location_access, can_control_playback ready'; END $$;

-- ============================================================
-- SECTION 5: RLS policies — clients
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[5/9] Updating RLS policies...'; END $$;

-- clients
DROP POLICY IF EXISTS "Users can view their associated clients" ON clients;
DROP POLICY IF EXISTS "Owners and admins can update clients" ON clients;
DROP POLICY IF EXISTS "Admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON clients;
DROP POLICY IF EXISTS "Users can view their client" ON clients;
DROP POLICY IF EXISTS "Admins and managers can manage clients" ON clients;

CREATE POLICY "Users can view their associated clients"
ON clients FOR SELECT
USING (
  public.is_admin()
  OR owner_id = auth.uid()
  OR public.user_has_client_access(id)
);

CREATE POLICY "Owners and admins can update clients"
ON clients FOR UPDATE
USING (public.is_admin() OR owner_id = auth.uid())
WITH CHECK (public.is_admin() OR owner_id = auth.uid());

CREATE POLICY "Admins can insert clients"
ON clients FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete clients"
ON clients FOR DELETE
USING (public.is_admin());

-- locations
DROP POLICY IF EXISTS "Users can view their associated locations" ON locations;
DROP POLICY IF EXISTS "Managers and owners can update locations" ON locations;
DROP POLICY IF EXISTS "Users can view accessible locations" ON locations;
DROP POLICY IF EXISTS "Admins and managers can manage locations" ON locations;

CREATE POLICY "Users can view their associated locations"
ON locations FOR SELECT
USING (
  public.is_admin()
  OR manager_id = auth.uid()
  OR public.user_has_location_access(id)
  OR client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
);

CREATE POLICY "Managers and owners can update locations"
ON locations FOR UPDATE
USING (
  public.is_admin()
  OR manager_id = auth.uid()
  OR client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
)
WITH CHECK (
  public.is_admin()
  OR manager_id = auth.uid()
  OR client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
);

-- play_history
DROP POLICY IF EXISTS "Users can view play history for their access scope" ON play_history;
DROP POLICY IF EXISTS "Users can view their play history" ON play_history;
DROP POLICY IF EXISTS "Users can insert own play history" ON play_history;

CREATE POLICY "Users can view play history for their access scope"
ON play_history FOR SELECT
USING (
  public.is_admin()
  OR auth.uid() = user_id
  OR (client_id IS NOT NULL AND public.user_has_client_access(client_id))
  OR (location_id IS NOT NULL AND public.user_has_location_access(location_id))
);

CREATE POLICY "Users can insert own play history"
ON play_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- user_profiles
DROP POLICY IF EXISTS "Users can view profiles in their scope" ON user_profiles;

CREATE POLICY "Users can view profiles in their scope"
ON user_profiles FOR SELECT
USING (
  id = auth.uid()
  OR public.is_admin()
  OR public.is_manager_or_admin()
  OR client_id IN (
    SELECT client_id FROM user_profiles WHERE id = auth.uid() AND access_level = 'account'
  )
  OR location_id IN (
    SELECT location_id FROM user_profiles WHERE id = auth.uid() AND access_level = 'location'
  )
);

-- playlists
DROP POLICY IF EXISTS "Users can view accessible playlists" ON playlists;

CREATE POLICY "Users can view accessible playlists"
ON playlists FOR SELECT
USING (
  is_public = true
  OR public.is_admin()
  OR id IN (
    SELECT playlist_id FROM playlist_permissions WHERE user_id = auth.uid()
  )
);

-- playback_sessions
DROP POLICY IF EXISTS "Users can view playback sessions" ON playback_sessions;
DROP POLICY IF EXISTS "Account managers can control playback" ON playback_sessions;
DROP POLICY IF EXISTS "Users can insert playback sessions" ON playback_sessions;
DROP POLICY IF EXISTS "Users can update playback sessions" ON playback_sessions;

CREATE POLICY "Users can view playback sessions"
ON playback_sessions FOR SELECT
USING (
  public.is_admin()
  OR client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
  OR client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid() AND up.is_active = true
  )
  OR client_id IN (
    SELECT l.client_id FROM locations l WHERE l.manager_id = auth.uid()
  )
);

CREATE POLICY "Users can insert playback sessions"
ON playback_sessions FOR INSERT
WITH CHECK (
  public.is_admin()
  OR client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
  OR client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('manager', 'admin')
    AND up.access_level = 'account'
    AND up.is_active = true
  )
);

CREATE POLICY "Users can update playback sessions"
ON playback_sessions FOR UPDATE
USING (
  public.is_admin()
  OR client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
  OR client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('manager', 'admin')
    AND up.access_level = 'account'
    AND up.is_active = true
  )
)
WITH CHECK (
  public.is_admin()
  OR client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
  OR client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('manager', 'admin')
    AND up.access_level = 'account'
    AND up.is_active = true
  )
);

DO $$ BEGIN RAISE NOTICE '  ✓ All RLS policies updated'; END $$;

-- ============================================================
-- SECTION 6: Analytics views
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[6/9] Creating/replacing analytics views...'; END $$;

CREATE OR REPLACE VIEW analytics_by_account AS
SELECT
  c.id as account_id,
  c.name as account_name,
  c.is_active,
  COUNT(DISTINCT l.id) as total_venues,
  COUNT(DISTINCT ph.id) as total_plays,
  SUM(ph.stream_duration) as total_seconds_played,
  COUNT(DISTINCT ph.user_id) as unique_users,
  COUNT(DISTINCT ph.song_id) as unique_songs,
  MAX(ph.played_at) as last_activity
FROM clients c
LEFT JOIN locations l ON c.id = l.client_id
LEFT JOIN play_history ph ON c.id = ph.client_id
  AND (ph.valid_for_royalties = true OR ph.id IS NULL)
GROUP BY c.id, c.name, c.is_active
ORDER BY c.name;

CREATE OR REPLACE VIEW analytics_by_venue AS
SELECT
  c.id as account_id,
  c.name as account_name,
  l.id as venue_id,
  l.name as venue_name,
  l.city,
  l.is_active,
  COUNT(DISTINCT ph.id) as total_plays,
  SUM(ph.stream_duration) as total_seconds_played,
  COUNT(DISTINCT ph.user_id) as unique_users,
  COUNT(DISTINCT ph.song_id) as unique_songs,
  MAX(ph.played_at) as last_activity
FROM locations l
JOIN clients c ON l.client_id = c.id
LEFT JOIN play_history ph ON l.id = ph.location_id
  AND (ph.valid_for_royalties = true OR ph.id IS NULL)
GROUP BY c.id, c.name, l.id, l.name, l.city, l.is_active
ORDER BY c.name, l.name;

CREATE OR REPLACE VIEW user_access_summary AS
SELECT
  up.id as user_id,
  up.full_name,
  up.email,
  up.role,
  up.access_level,
  up.is_active,
  c.id as account_id,
  c.name as account_name,
  l.id as venue_id,
  l.name as venue_name,
  CASE
    WHEN up.access_level = 'account' AND c.name IS NOT NULL THEN 'Todas las sedes de ' || c.name
    WHEN up.access_level = 'location' AND l.name IS NOT NULL THEN l.name || ' únicamente'
    WHEN up.role = 'admin' THEN 'Administrador - Acceso total'
    ELSE 'Sin acceso asignado'
  END as access_description
FROM user_profiles up
LEFT JOIN clients c ON up.client_id = c.id
LEFT JOIN locations l ON up.location_id = l.id
ORDER BY c.name NULLS LAST, l.name NULLS LAST, up.full_name;

DO $$ BEGIN RAISE NOTICE '  ✓ Views analytics_by_account, analytics_by_venue, user_access_summary ready'; END $$;

-- ============================================================
-- SECTION 7: Data migration for existing users
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[7/9] Running data migration for existing users...'; END $$;

DO $$
DECLARE
  v_updated_location INT;
  v_updated_account  INT;
  v_updated_default  INT;
BEGIN
  -- Users with location_id and no access_level → 'location'
  UPDATE user_profiles
  SET access_level = 'location'
  WHERE access_level IS NULL AND location_id IS NOT NULL;
  GET DIAGNOSTICS v_updated_location = ROW_COUNT;

  -- Admin/manager without location → 'account'
  UPDATE user_profiles
  SET access_level = 'account'
  WHERE access_level IS NULL AND role IN ('admin', 'manager');
  GET DIAGNOSTICS v_updated_account = ROW_COUNT;

  -- Remaining → 'location'
  UPDATE user_profiles
  SET access_level = 'location'
  WHERE access_level IS NULL;
  GET DIAGNOSTICS v_updated_default = ROW_COUNT;

  RAISE NOTICE '  Users set to location (had location_id): %', v_updated_location;
  RAISE NOTICE '  Users set to account (admin/manager):    %', v_updated_account;
  RAISE NOTICE '  Users set to location (default):         %', v_updated_default;
END $$;

-- ============================================================
-- SECTION 8: Refresh PostgREST schema cache
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[8/9] Refreshing schema cache...'; END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- SECTION 9: Verification report
-- ============================================================

DO $$ BEGIN RAISE NOTICE '[9/9] Running verification report...'; END $$;

SELECT '=== COLUMN CHECK ===' AS section, '' AS detail

UNION ALL

SELECT
  'clients.' || column_name,
  data_type || COALESCE(' DEFAULT ' || column_default, '')
FROM information_schema.columns
WHERE table_name = 'clients'
  AND column_name IN ('owner_id', 'playback_mode')

UNION ALL

SELECT
  'locations.' || column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'locations'
  AND column_name = 'manager_id'

UNION ALL

SELECT
  'user_profiles.' || column_name,
  data_type || COALESCE(' DEFAULT ' || column_default, '')
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('access_level', 'client_id')

UNION ALL

SELECT '=== VIEWS ===' AS section, '' AS detail

UNION ALL

SELECT
  viewname,
  'EXISTS'
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('analytics_by_account', 'analytics_by_venue', 'user_access_summary')

UNION ALL

SELECT '=== FUNCTIONS ===' AS section, '' AS detail

UNION ALL

SELECT
  routine_name,
  'EXISTS'
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('user_has_client_access', 'user_has_location_access', 'can_control_playback')

UNION ALL

SELECT '=== USER ACCESS LEVELS ===' AS section, '' AS detail

UNION ALL

SELECT
  'role: ' || role || ' | access_level: ' || COALESCE(access_level, 'NULL'),
  'count: ' || COUNT(*)::text
FROM user_profiles
GROUP BY role, access_level
ORDER BY 1;
