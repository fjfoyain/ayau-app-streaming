-- ================================================
-- RLS Policies for Account/Venue Access Control
-- ================================================
-- This migration updates Row Level Security policies to support
-- account-level and location-level user access.

-- ================================================
-- Helper Functions
-- ================================================

-- Function: Check if user has access to a specific client/account
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
      -- Admin has access to all
      role = 'admin'
      OR
      -- Account-level user with this client
      (access_level = 'account' AND client_id = target_client_id)
      OR
      -- Location-level user whose location belongs to this client
      (access_level = 'location' AND location_id IN (
        SELECT id FROM locations WHERE client_id = target_client_id
      ))
    )
    AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.user_has_client_access IS
'Check if current user has access to a specific client/account (via direct assignment or through location)';

-- Function: Check if user has access to a specific location/venue
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
      -- Admin has access to all
      up.role = 'admin'
      OR
      -- Account-level user (has access to all locations under their client)
      (up.access_level = 'account' AND l.id = target_location_id)
      OR
      -- Location-level user (only their specific location)
      (up.access_level = 'location' AND up.location_id = target_location_id)
    )
    AND up.is_active = true
  );
$$;

COMMENT ON FUNCTION public.user_has_location_access IS
'Check if current user has access to a specific location/venue (account-level users see all venues under their client)';

-- ================================================
-- Update Clients Table Policies
-- ================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their client" ON clients;
DROP POLICY IF EXISTS "Managers can manage clients" ON clients;
DROP POLICY IF EXISTS "Admins and managers can manage clients" ON clients;

-- Policy: Users can view clients they have access to
CREATE POLICY "Users can view their client"
ON clients FOR SELECT
USING (
  public.is_admin() OR
  public.user_has_client_access(id)
);

-- Policy: Managers and admins can manage all clients
CREATE POLICY "Admins and managers can manage clients"
ON clients FOR ALL
USING (public.is_manager_or_admin())
WITH CHECK (public.is_manager_or_admin());

-- ================================================
-- Update Locations Table Policies
-- ================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view accessible locations" ON locations;
DROP POLICY IF EXISTS "Managers can manage locations" ON locations;
DROP POLICY IF EXISTS "Admins and managers can manage locations" ON locations;

-- Policy: Users can view locations they have access to
CREATE POLICY "Users can view accessible locations"
ON locations FOR SELECT
USING (
  public.is_admin() OR
  public.user_has_location_access(id)
);

-- Policy: Managers and admins can manage all locations
CREATE POLICY "Admins and managers can manage locations"
ON locations FOR ALL
USING (public.is_manager_or_admin())
WITH CHECK (public.is_manager_or_admin());

-- ================================================
-- Update Play History Policies
-- ================================================

-- Drop existing play_history view policies if they exist
DROP POLICY IF EXISTS "Users can view play history for their access scope" ON play_history;
DROP POLICY IF EXISTS "Users can view their play history" ON play_history;

-- Policy: Users can view play history for their access scope
CREATE POLICY "Users can view play history for their access scope"
ON play_history FOR SELECT
USING (
  public.is_admin() OR
  auth.uid() = user_id OR
  (client_id IS NOT NULL AND public.user_has_client_access(client_id)) OR
  (location_id IS NOT NULL AND public.user_has_location_access(location_id))
);

-- Policy: Users can insert their own play history
-- (This policy should already exist, but we ensure it's correct)
DROP POLICY IF EXISTS "Users can insert own play history" ON play_history;
CREATE POLICY "Users can insert own play history"
ON play_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ================================================
-- Update User Profiles Policies (if needed)
-- ================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view profiles in their scope" ON user_profiles;

-- Policy: Users can view other users in their access scope
CREATE POLICY "Users can view profiles in their scope"
ON user_profiles FOR SELECT
USING (
  -- Users can always see their own profile
  id = auth.uid()
  OR
  -- Admins can see all profiles
  public.is_admin()
  OR
  -- Managers can see all profiles
  public.is_manager_or_admin()
  OR
  -- Account-level users can see users in their account
  (
    client_id IN (
      SELECT client_id FROM user_profiles WHERE id = auth.uid() AND access_level = 'account'
    )
  )
  OR
  -- Location-level users can see users in their location
  (
    location_id IN (
      SELECT location_id FROM user_profiles WHERE id = auth.uid() AND access_level = 'location'
    )
  )
);

-- ================================================
-- Update Playlist Permissions (if applicable)
-- ================================================
-- These policies ensure playlists respect the access hierarchy

DROP POLICY IF EXISTS "Users can view accessible playlists" ON playlists;

-- Policy: Users can view public playlists or playlists they have permission for
CREATE POLICY "Users can view accessible playlists"
ON playlists FOR SELECT
USING (
  is_public = true
  OR
  public.is_admin()
  OR
  -- User has explicit permission for this playlist
  id IN (
    SELECT playlist_id
    FROM playlist_permissions
    WHERE user_id = auth.uid()
  )
);

-- ================================================
-- Verification Queries
-- ================================================
-- Run these to test the policies work correctly

/*
-- Test client access function
SELECT
  id,
  name,
  public.user_has_client_access(id) as has_access
FROM clients
LIMIT 5;

-- Test location access function
SELECT
  l.id,
  l.name,
  c.name as client_name,
  public.user_has_location_access(l.id) as has_access
FROM locations l
JOIN clients c ON l.client_id = c.id
LIMIT 5;

-- Verify play_history filtering
SELECT
  ph.id,
  s.title,
  c.name as client_name,
  l.name as location_name
FROM play_history ph
JOIN songs s ON ph.song_id = s.id
LEFT JOIN clients c ON ph.client_id = c.id
LEFT JOIN locations l ON ph.location_id = l.id
LIMIT 10;
*/

-- ================================================
-- Grant Permissions
-- ================================================

-- Grant execute permissions on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION public.user_has_client_access TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_location_access TO authenticated;
