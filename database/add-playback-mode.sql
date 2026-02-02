-- ================================================
-- Add Playback Mode to Clients Table
-- ================================================
-- This migration adds support for three playback modes per account:
-- 1. independent - Each venue plays independently
-- 2. shared_playlist - Same playlists, independent playback
-- 3. synchronized - One admin controls all venues

-- ================================================
-- Step 1: Add playback_mode column to clients
-- ================================================

ALTER TABLE clients
ADD COLUMN IF NOT EXISTS playback_mode VARCHAR(20) DEFAULT 'independent';

-- Add constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_playback_mode'
  ) THEN
    ALTER TABLE clients
    ADD CONSTRAINT check_playback_mode
    CHECK (playback_mode IN ('independent', 'shared_playlist', 'synchronized'));
  END IF;
END $$;

COMMENT ON COLUMN clients.playback_mode IS
'Playback synchronization mode: independent, shared_playlist, or synchronized';

-- ================================================
-- Step 2: Ensure playback_sessions table exists
-- ================================================

CREATE TABLE IF NOT EXISTS playback_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  -- Playback state
  is_centralized BOOLEAN DEFAULT false,
  current_song_id UUID REFERENCES songs(id),
  current_playlist_id UUID REFERENCES playlists(id),
  playback_state VARCHAR(20) DEFAULT 'stopped', -- 'playing', 'paused', 'stopped'
  playback_position INTEGER DEFAULT 0, -- Seconds into current song
  volume INTEGER DEFAULT 70,

  -- Playlist position
  playlist_song_index INTEGER DEFAULT 0,

  -- Controller info
  controlled_by UUID REFERENCES auth.users(id),
  controller_heartbeat TIMESTAMPTZ,

  -- Sync ordering
  sequence_number BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id)
);

-- Add missing columns if table already exists
ALTER TABLE playback_sessions
ADD COLUMN IF NOT EXISTS playlist_song_index INTEGER DEFAULT 0;

ALTER TABLE playback_sessions
ADD COLUMN IF NOT EXISTS sequence_number BIGINT DEFAULT 0;

ALTER TABLE playback_sessions
ADD COLUMN IF NOT EXISTS controller_heartbeat TIMESTAMPTZ;

-- ================================================
-- Step 3: Enable RLS on playback_sessions
-- ================================================

ALTER TABLE playback_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Account managers can control playback" ON playback_sessions;
DROP POLICY IF EXISTS "Users can view their account playback session" ON playback_sessions;

-- Policy: Users can view playback sessions for their account
CREATE POLICY "Users can view their account playback session"
ON playback_sessions FOR SELECT
USING (
  -- Platform admins can see all
  public.is_admin()
  OR
  -- Account-level users can see their account's session
  client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.access_level = 'account'
    AND up.is_active = true
  )
  OR
  -- Location-level users can see their account's session
  client_id IN (
    SELECT l.client_id FROM locations l
    JOIN user_profiles up ON up.location_id = l.id
    WHERE up.id = auth.uid()
    AND up.is_active = true
  )
);

-- Policy: Account managers can control (insert/update/delete) playback sessions
CREATE POLICY "Account managers can control playback"
ON playback_sessions FOR ALL
USING (
  -- Platform admins can control all
  public.is_admin()
  OR
  -- Account managers can control their account's session
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
  client_id IN (
    SELECT up.client_id FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('manager', 'admin')
    AND up.access_level = 'account'
    AND up.is_active = true
  )
);

-- ================================================
-- Step 4: Enable Realtime for playback_sessions
-- ================================================

-- Enable realtime for the table (run in Supabase dashboard if needed)
-- ALTER PUBLICATION supabase_realtime ADD TABLE playback_sessions;

-- ================================================
-- Step 5: Create function to update timestamp
-- ================================================

CREATE OR REPLACE FUNCTION update_playback_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp update
DROP TRIGGER IF EXISTS update_playback_sessions_timestamp ON playback_sessions;
CREATE TRIGGER update_playback_sessions_timestamp
  BEFORE UPDATE ON playback_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_playback_session_timestamp();

-- ================================================
-- Verification
-- ================================================

SELECT '=== MIGRATION COMPLETE ===' as status;

-- Verify clients table has playback_mode
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name = 'playback_mode';

-- Verify playback_sessions table structure
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'playback_sessions'
ORDER BY ordinal_position;

-- Show policies
SELECT
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'playback_sessions';
