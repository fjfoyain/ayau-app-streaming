-- ================================================
-- Fix Admin Access - Update RLS Helper Functions
-- ================================================
-- This ensures admins and managers can always access resources
-- regardless of their access_level or client_id values

-- Recreate user_has_client_access to handle NULL access_level for admins
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
      -- Admin and Manager have access to all (regardless of access_level)
      role IN ('admin', 'manager')
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

-- Recreate user_has_location_access to handle NULL access_level for admins
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
      -- Admin and Manager have access to all (regardless of access_level)
      up.role IN ('admin', 'manager')
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

-- Verify admin can access clients
SELECT
  up.email,
  up.role,
  up.access_level,
  up.is_active,
  public.is_admin() as is_admin_check,
  public.is_manager_or_admin() as is_manager_admin_check
FROM user_profiles up
WHERE up.id = auth.uid();
