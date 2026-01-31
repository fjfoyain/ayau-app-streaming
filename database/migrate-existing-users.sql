-- ================================================
-- Migration: Update Existing Users with Access Levels
-- ================================================
-- This migration sets appropriate access_level values for existing users
-- to ensure they can continue accessing the system after RLS policy updates

-- Update admin users - they don't need access_level constraints
UPDATE user_profiles
SET access_level = NULL
WHERE role = 'admin' AND access_level IS NULL;

-- Update manager users - they don't need access_level constraints
UPDATE user_profiles
SET access_level = NULL
WHERE role = 'manager' AND access_level IS NULL;

-- Update regular users who have a location assigned
UPDATE user_profiles
SET access_level = 'location'
WHERE role NOT IN ('admin', 'manager')
  AND location_id IS NOT NULL
  AND access_level IS NULL;

-- For users without a location, set to location by default
UPDATE user_profiles
SET access_level = 'location'
WHERE role NOT IN ('admin', 'manager')
  AND access_level IS NULL;

-- Verify the migration
SELECT
  role,
  access_level,
  COUNT(*) as user_count
FROM user_profiles
GROUP BY role, access_level
ORDER BY role, access_level;
