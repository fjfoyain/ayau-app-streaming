-- ================================================
-- Add Owner/Manager Relationships
-- ================================================
-- This migration adds:
-- 1. owner_id to clients (account owner)
-- 2. manager_id to locations (venue manager)
-- The account owner automatically becomes the DJ controller in sync mode

-- ================================================
-- Step 1: Add owner_id to clients
-- ================================================

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN clients.owner_id IS
'The user who owns this account. Has full access and becomes DJ controller in sync mode.';

-- Create index for owner lookup
CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON clients(owner_id);

-- ================================================
-- Step 2: Add manager_id to locations
-- ================================================

ALTER TABLE locations
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN locations.manager_id IS
'The user who manages this venue/location.';

-- Create index for manager lookup
CREATE INDEX IF NOT EXISTS idx_locations_manager_id ON locations(manager_id);

-- ================================================
-- Step 3: Update RLS policies to include owner access
-- ================================================

-- Drop existing client policies to recreate with owner logic
DROP POLICY IF EXISTS "Users can view their associated clients" ON clients;
DROP POLICY IF EXISTS "Admins and managers can update clients" ON clients;
DROP POLICY IF EXISTS "Owners and admins can update clients" ON clients;
DROP POLICY IF EXISTS "Admins and managers can insert clients" ON clients;
DROP POLICY IF EXISTS "Admins can insert clients" ON clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON clients;

-- Policy: View clients (owners can always see their accounts)
CREATE POLICY "Users can view their associated clients"
ON clients FOR SELECT
USING (
  public.is_admin()
  OR
  owner_id = auth.uid()
  OR
  public.user_has_client_access(id)
);

-- Policy: Update clients (owners and admins can update)
CREATE POLICY "Owners and admins can update clients"
ON clients FOR UPDATE
USING (
  public.is_admin()
  OR
  owner_id = auth.uid()
)
WITH CHECK (
  public.is_admin()
  OR
  owner_id = auth.uid()
);

-- Policy: Insert clients (admins only)
CREATE POLICY "Admins can insert clients"
ON clients FOR INSERT
WITH CHECK (public.is_admin());

-- Policy: Delete clients (admins only)
CREATE POLICY "Admins can delete clients"
ON clients FOR DELETE
USING (public.is_admin());

-- ================================================
-- Step 4: Update location RLS for manager access
-- ================================================

DROP POLICY IF EXISTS "Users can view their associated locations" ON locations;
DROP POLICY IF EXISTS "Managers can update their locations" ON locations;
DROP POLICY IF EXISTS "Managers and owners can update locations" ON locations;

-- Policy: View locations (managers can see their venues)
CREATE POLICY "Users can view their associated locations"
ON locations FOR SELECT
USING (
  public.is_admin()
  OR
  manager_id = auth.uid()
  OR
  public.user_has_location_access(id)
  OR
  client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
);

-- Policy: Update locations (managers and owners can update)
CREATE POLICY "Managers and owners can update locations"
ON locations FOR UPDATE
USING (
  public.is_admin()
  OR
  manager_id = auth.uid()
  OR
  client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
)
WITH CHECK (
  public.is_admin()
  OR
  manager_id = auth.uid()
  OR
  client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
);

-- ================================================
-- Step 5: Function to check if user can control playback
-- ================================================

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

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user is account owner
  SELECT EXISTS(
    SELECT 1 FROM clients
    WHERE id = p_client_id AND owner_id = v_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN TRUE;
  END IF;

  -- Check if user is account-level manager
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

-- ================================================
-- Step 6: Function to delete user safely
-- ================================================

CREATE OR REPLACE FUNCTION public.delete_user_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_caller_id := auth.uid();

  -- Only platform admins can delete users
  SELECT EXISTS(
    SELECT 1 FROM user_profiles
    WHERE id = v_caller_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only platform admins can delete users';
  END IF;

  -- Don't allow deleting self
  IF p_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Clear owner_id references
  UPDATE clients SET owner_id = NULL WHERE owner_id = p_user_id;

  -- Clear manager_id references
  UPDATE locations SET manager_id = NULL WHERE manager_id = p_user_id;

  -- Clear controller references in playback sessions
  UPDATE playback_sessions SET controlled_by = NULL WHERE controlled_by = p_user_id;

  -- Deactivate the user profile (soft delete)
  UPDATE user_profiles
  SET is_active = false, updated_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ================================================
-- Verification
-- ================================================

SELECT '=== MIGRATION COMPLETE ===' as status;

-- Verify clients has owner_id
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'owner_id';

-- Verify locations has manager_id
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'locations' AND column_name = 'manager_id';

-- Show new functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('can_control_playback', 'delete_user_profile');
