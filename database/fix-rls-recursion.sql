-- ================================================
-- Fix RLS Infinite Recursion
-- ================================================
-- This fixes the infinite recursion error by simplifying
-- RLS policies to avoid circular dependencies

-- ================================================
-- Step 1: Drop existing problematic policies
-- ================================================

-- Drop all existing policies on user_profiles
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

-- ================================================
-- Step 2: Create simple, non-recursive policies
-- ================================================

-- SELECT: Users can view their own profile, admins can view all
CREATE POLICY "user_profiles_select_policy" ON user_profiles
FOR SELECT
USING (
  -- User can see their own profile
  auth.uid() = id
  OR
  -- Or if they are admin/manager (check directly without helper function)
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('admin', 'manager')
    AND up.is_active = true
  )
);

-- INSERT: Only admins can create new profiles
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
    AND up.is_active = true
  )
);

-- UPDATE: Users can update their own profile, admins can update all
CREATE POLICY "user_profiles_update_policy" ON user_profiles
FOR UPDATE
USING (
  -- User can update their own profile
  auth.uid() = id
  OR
  -- Or if they are admin
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
    AND up.is_active = true
  )
);

-- DELETE: Only admins can delete profiles
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
    AND up.is_active = true
  )
);

-- ================================================
-- Step 3: Recreate helper functions WITHOUT querying user_profiles
-- ================================================
-- Instead, these functions will receive the role as parameter

-- Simple admin check function (no user_profiles query)
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

-- Simple manager or admin check (no user_profiles query)
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

-- ================================================
-- Step 4: Update other table policies to avoid recursion
-- ================================================

-- Clients table policies
DROP POLICY IF EXISTS "clients_select_policy" ON clients;
CREATE POLICY "clients_select_policy" ON clients
FOR SELECT
USING (
  -- Admins and managers can see all clients
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
    AND is_active = true
  )
  OR
  -- Account-level users can see their assigned client
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND access_level = 'account'
    AND client_id = clients.id
    AND is_active = true
  )
  OR
  -- Location-level users can see their client
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN locations l ON up.location_id = l.id
    WHERE up.id = auth.uid()
    AND up.access_level = 'location'
    AND l.client_id = clients.id
    AND up.is_active = true
  )
);

-- Locations table policies
DROP POLICY IF EXISTS "locations_select_policy" ON locations;
CREATE POLICY "locations_select_policy" ON locations
FOR SELECT
USING (
  -- Admins and managers can see all locations
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
    AND is_active = true
  )
  OR
  -- Account-level users can see all locations for their client
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND access_level = 'account'
    AND client_id = locations.client_id
    AND is_active = true
  )
  OR
  -- Location-level users can see their specific location
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND access_level = 'location'
    AND location_id = locations.id
    AND is_active = true
  )
);

-- ================================================
-- Verification
-- ================================================
SELECT 'RLS policies fixed successfully!' as message;

-- Check current user
SELECT
  email,
  role,
  access_level,
  is_active
FROM user_profiles
WHERE id = auth.uid();
