-- ================================================
-- Fix Owner/Manager Foreign Key References
-- ================================================
-- The original migration referenced auth.users but the queries
-- need to join with user_profiles. This fixes the FK relationships.

-- ================================================
-- Step 1: Drop existing foreign key constraints
-- ================================================

-- Drop FK on clients.owner_id (if exists)
DO $$
BEGIN
  ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_owner_id_fkey;
EXCEPTION WHEN undefined_object THEN
  -- Constraint doesn't exist, that's fine
END $$;

-- Drop FK on locations.manager_id (if exists)
DO $$
BEGIN
  ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_manager_id_fkey;
EXCEPTION WHEN undefined_object THEN
  -- Constraint doesn't exist, that's fine
END $$;

-- ================================================
-- Step 2: Add new foreign keys pointing to user_profiles
-- ================================================

-- Add FK for owner_id -> user_profiles
ALTER TABLE clients
ADD CONSTRAINT clients_owner_id_fkey
FOREIGN KEY (owner_id) REFERENCES user_profiles(id)
ON DELETE SET NULL;

-- Add FK for manager_id -> user_profiles
ALTER TABLE locations
ADD CONSTRAINT locations_manager_id_fkey
FOREIGN KEY (manager_id) REFERENCES user_profiles(id)
ON DELETE SET NULL;

-- ================================================
-- Step 2b: Fix play_history FK to user_profiles
-- ================================================

-- Drop existing FK on play_history.user_id (if exists)
DO $$
BEGIN
  ALTER TABLE play_history DROP CONSTRAINT IF EXISTS play_history_user_id_fkey;
EXCEPTION WHEN undefined_object THEN
  -- Constraint doesn't exist, that's fine
END $$;

-- Add FK for play_history.user_id -> user_profiles
-- Only add if user_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'play_history' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE play_history
    ADD CONSTRAINT play_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES user_profiles(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- ================================================
-- Step 3: Refresh PostgREST schema cache
-- ================================================

NOTIFY pgrst, 'reload schema';

-- ================================================
-- Verification
-- ================================================

SELECT '=== FK MIGRATION COMPLETE ===' as status;

-- Verify new foreign keys exist
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    (tc.table_name IN ('clients', 'locations') AND kcu.column_name IN ('owner_id', 'manager_id'))
    OR
    (tc.table_name = 'play_history' AND kcu.column_name = 'user_id')
  );
