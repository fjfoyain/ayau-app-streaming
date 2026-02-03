-- ================================================
-- Add email_verified_manually column to user_profiles
-- ================================================
-- This allows admins to manually verify users
-- without needing access to auth.users table
-- ================================================

-- Add column for manual email verification
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email_verified_manually BOOLEAN DEFAULT false;

-- Add column for who verified and when
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email_verified_manually_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email_verified_manually_by UUID REFERENCES user_profiles(id);

-- Comment
COMMENT ON COLUMN user_profiles.email_verified_manually IS 'True if an admin manually verified this user email';
COMMENT ON COLUMN user_profiles.email_verified_manually_at IS 'When the email was manually verified';
COMMENT ON COLUMN user_profiles.email_verified_manually_by IS 'Which admin manually verified the email';

-- ================================================
-- VERIFICATION
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '=== Email Verification Columns Added ===';
  RAISE NOTICE '';
  RAISE NOTICE 'New columns in user_profiles:';
  RAISE NOTICE '  - email_verified_manually (BOOLEAN)';
  RAISE NOTICE '  - email_verified_manually_at (TIMESTAMPTZ)';
  RAISE NOTICE '  - email_verified_manually_by (UUID)';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: email_confirmed_at is in auth.users (Supabase internal)';
  RAISE NOTICE 'This column allows manual verification by admins';
END $$;
