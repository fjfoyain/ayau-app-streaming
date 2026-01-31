-- ================================================
-- Add User Access Level Fields to user_profiles
-- ================================================
-- This migration adds support for account-level and location-level user access.
-- Account-level users can access all venues under a client/account.
-- Location-level users can only access a specific venue/location.

-- Add access_level field to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS access_level VARCHAR(20) DEFAULT 'location';

-- Possible values: 'account', 'location'
-- 'account' = user can access all venues under their client/account
-- 'location' = user can only access their specific location/venue

COMMENT ON COLUMN user_profiles.access_level IS
'Access scope: account = all venues under client, location = specific venue only';

-- Add client_id for account-level users (denormalized for performance)
-- For account-level users, client_id will be set and location_id will be null
-- For location-level users, location_id will be set and client_id will be null
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_profiles.client_id IS
'Client/Account reference for account-level users (NULL for location-level users)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_client ON user_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_access_level ON user_profiles(access_level);

-- Add constraint to ensure valid access_level values
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS check_access_level;

ALTER TABLE user_profiles
ADD CONSTRAINT check_access_level
CHECK (access_level IN ('account', 'location'));

-- ================================================
-- Data Migration for Existing Users
-- ================================================
-- Set access_level for existing users based on current data

-- Users with location_id get 'location' access
UPDATE user_profiles
SET access_level = 'location'
WHERE access_level IS NULL AND location_id IS NOT NULL;

-- Admin and Manager users without location get 'account' access
-- (They need a client assigned manually later)
UPDATE user_profiles
SET access_level = 'account'
WHERE access_level IS NULL AND role IN ('admin', 'manager');

-- Remaining users (if any) default to 'location'
UPDATE user_profiles
SET access_level = 'location'
WHERE access_level IS NULL;

-- ================================================
-- Verification Query
-- ================================================
-- Run this to verify the migration worked correctly
/*
SELECT
  role,
  access_level,
  COUNT(*) as user_count,
  COUNT(DISTINCT client_id) as clients_assigned,
  COUNT(DISTINCT location_id) as locations_assigned
FROM user_profiles
GROUP BY role, access_level
ORDER BY role, access_level;
*/
