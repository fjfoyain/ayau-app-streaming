-- ================================================
-- Remote Control / Reproductor Activo Feature
-- ================================================
-- Allows users with remote_control_enabled=true to log in from two devices.
-- First device becomes "Reproductor Activo" (plays audio).
-- Second device becomes "Control Remoto" (no audio, controls playback).

-- ================================================
-- Step 1: Feature flag on user_profiles
-- ================================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS remote_control_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN user_profiles.remote_control_enabled IS
'When true, this user participates in the Remote Control / Active Player feature.
 First device to log in becomes the Reproductor Activo; subsequent devices become
 Control Remoto instances.';

-- ================================================
-- Step 2: Device session tracking table
-- ================================================
CREATE TABLE IF NOT EXISTS user_device_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,           -- sessionStorage UUID, tab-scoped
  role            TEXT NOT NULL DEFAULT 'remote',
                                           -- 'active_player' | 'remote'
  last_heartbeat  TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_user_device UNIQUE (user_id, device_id),
  CONSTRAINT check_device_role CHECK (role IN ('active_player', 'remote'))
);

-- Enforce single active_player per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_active_player
  ON user_device_sessions (user_id)
  WHERE role = 'active_player';

COMMENT ON TABLE user_device_sessions IS
'Tracks per-device roles for the Remote Control feature.
 One row per (user, browser tab). Cleaned up on logout or heartbeat timeout.';

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_device_sessions_user
  ON user_device_sessions (user_id);

-- ================================================
-- Step 3: RLS
-- ================================================
ALTER TABLE user_device_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own device sessions
CREATE POLICY "Users manage own device sessions"
  ON user_device_sessions FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all (for debugging)
CREATE POLICY "Admins view all device sessions"
  ON user_device_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ================================================
-- Step 4: RPC — claim active_player role atomically
-- Handles race conditions when two devices try to claim simultaneously.
-- Returns TRUE if claim succeeded, FALSE if another non-stale AP exists.
-- ================================================
CREATE OR REPLACE FUNCTION public.claim_active_player(
  p_user_id   UUID,
  p_device_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stale_threshold INTERVAL := INTERVAL '35 seconds';
BEGIN
  -- Verify caller is the user they claim to be
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Demote any existing active_player for this user if stale
  UPDATE user_device_sessions
  SET role = 'remote'
  WHERE user_id = p_user_id
    AND role = 'active_player'
    AND last_heartbeat < NOW() - v_stale_threshold;

  -- Upsert this device as active_player
  INSERT INTO user_device_sessions (user_id, device_id, role, last_heartbeat)
  VALUES (p_user_id, p_device_id, 'active_player', NOW())
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET role = 'active_player', last_heartbeat = NOW();

  RETURN TRUE;
EXCEPTION
  WHEN unique_violation THEN
    -- Another non-stale active_player exists; this device stays as remote
    RETURN FALSE;
END;
$$;

-- ================================================
-- Step 5: RPC — release active_player role
-- Called on logout or beforeunload to cleanly demote to remote.
-- ================================================
CREATE OR REPLACE FUNCTION public.release_active_player(
  p_user_id   UUID,
  p_device_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM user_device_sessions
  WHERE user_id = p_user_id AND device_id = p_device_id;
END;
$$;

-- ================================================
-- Step 6: Refresh schema cache
-- ================================================
NOTIFY pgrst, 'reload schema';

-- ================================================
-- Verification
-- ================================================
SELECT '=== REMOTE CONTROL MIGRATION COMPLETE ===' as status;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'remote_control_enabled';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'user_device_sessions';
