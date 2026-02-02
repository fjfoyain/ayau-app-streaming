-- ================================================
-- Add Playback Mode to Clients
-- ================================================
-- This adds the playback_mode column for synchronized playback

-- Add playback_mode column if it doesn't exist
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS playback_mode VARCHAR(20) DEFAULT 'independent';

-- Add constraint for valid values
DO $$
BEGIN
  ALTER TABLE clients
  ADD CONSTRAINT check_playback_mode
  CHECK (playback_mode IN ('independent', 'shared_playlist', 'synchronized'));
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, that's fine
END $$;

COMMENT ON COLUMN clients.playback_mode IS
'Playback mode: independent (each venue controls own music), shared_playlist (same playlists but independent playback), synchronized (one controller for all venues)';

-- ================================================
-- Update playback_sessions RLS policies
-- ================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view playback sessions" ON playback_sessions;
DROP POLICY IF EXISTS "Account managers can control playback" ON playback_sessions;
DROP POLICY IF EXISTS "Users can insert playback sessions" ON playback_sessions;
DROP POLICY IF EXISTS "Users can update playback sessions" ON playback_sessions;

-- Policy: View playback sessions (users with access to the client)
CREATE POLICY "Users can view playback sessions"
ON playback_sessions FOR SELECT
USING (
  public.is_admin()
  OR
  client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
  OR
  client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.is_active = true
  )
  OR
  client_id IN (
    SELECT l.client_id FROM locations l
    WHERE l.manager_id = auth.uid()
  )
);

-- Policy: Insert playback sessions (account owners and managers)
CREATE POLICY "Users can insert playback sessions"
ON playback_sessions FOR INSERT
WITH CHECK (
  public.is_admin()
  OR
  client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
  OR
  client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('manager', 'admin')
    AND up.access_level = 'account'
    AND up.is_active = true
  )
);

-- Policy: Update playback sessions (owners and account managers can control)
CREATE POLICY "Users can update playback sessions"
ON playback_sessions FOR UPDATE
USING (
  public.is_admin()
  OR
  client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
  OR
  client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('manager', 'admin')
    AND up.access_level = 'account'
    AND up.is_active = true
  )
)
WITH CHECK (
  public.is_admin()
  OR
  client_id IN (SELECT c.id FROM clients c WHERE c.owner_id = auth.uid())
  OR
  client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('manager', 'admin')
    AND up.access_level = 'account'
    AND up.is_active = true
  )
);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Verification
SELECT '=== PLAYBACK MODE MIGRATION COMPLETE ===' as status;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'playback_mode';
