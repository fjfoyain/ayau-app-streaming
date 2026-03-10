-- ============================================================
-- FIX: Infinite recursion in user_profiles RLS policy
-- ============================================================
-- The "Users can view profiles in their scope" policy queries
-- user_profiles inside itself → infinite recursion → 500 error.
-- Fix: use SECURITY DEFINER helper functions that bypass RLS.
-- ============================================================

-- Step 1: Drop the recursive policy immediately
DROP POLICY IF EXISTS "Users can view profiles in their scope" ON user_profiles;

-- Step 2: Create SECURITY DEFINER helpers (bypass RLS, no recursion)
CREATE OR REPLACE FUNCTION public.get_my_access_level()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT access_level FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_client_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT client_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_location_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT location_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_access_level  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_client_id     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_location_id   TO authenticated;

-- Step 3: Recreate the policy using helper functions (no recursion)
CREATE POLICY "Users can view profiles in their scope"
ON user_profiles FOR SELECT
USING (
  -- Always see own profile
  id = auth.uid()
  OR
  -- Admins and managers see everyone
  public.is_admin()
  OR
  public.is_manager_or_admin()
  OR
  -- Account-level users see other users in the same account
  (
    public.get_my_access_level() = 'account'
    AND public.get_my_client_id() IS NOT NULL
    AND client_id = public.get_my_client_id()
  )
  OR
  -- Location-level users see other users in the same location
  (
    public.get_my_access_level() = 'location'
    AND public.get_my_location_id() IS NOT NULL
    AND location_id = public.get_my_location_id()
  )
);

-- Step 4: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Step 5: Verify
SELECT '=== POLICY CHECK ===' AS status;
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

SELECT '=== FUNCTION CHECK ===' AS status;
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_my_access_level', 'get_my_client_id', 'get_my_location_id');
