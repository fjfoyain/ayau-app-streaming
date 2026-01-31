-- ================================================
-- Fix Admin User Access Level
-- ================================================
-- Set access_level to NULL for admin users
-- This allows them full access without restrictions

UPDATE user_profiles
SET access_level = NULL
WHERE role = 'admin';

-- Also fix managers
UPDATE user_profiles
SET access_level = NULL
WHERE role = 'manager';

-- Verify the fix
SELECT
  email,
  role,
  access_level,
  is_active
FROM user_profiles
WHERE role IN ('admin', 'manager')
ORDER BY email;
