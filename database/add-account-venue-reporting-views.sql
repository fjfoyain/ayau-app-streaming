-- ================================================
-- Account & Venue Reporting Views
-- ================================================
-- These views provide pre-aggregated analytics for fast reporting
-- at both the account level (sum of all venues) and individual venue level.

-- ================================================
-- View 1: Analytics by Account
-- ================================================
-- Aggregates statistics per account/client (sum of all venues)
-- Used for account-level reporting and comparative analysis

CREATE OR REPLACE VIEW analytics_by_account AS
SELECT
  c.id as account_id,
  c.name as account_name,
  c.is_active,
  COUNT(DISTINCT l.id) as total_venues,
  COUNT(DISTINCT ph.id) as total_plays,
  SUM(ph.stream_duration) as total_seconds_played,
  COUNT(DISTINCT ph.user_id) as unique_users,
  COUNT(DISTINCT ph.song_id) as unique_songs,
  MAX(ph.played_at) as last_activity
FROM clients c
LEFT JOIN locations l ON c.id = l.client_id
LEFT JOIN play_history ph ON c.id = ph.client_id AND (ph.valid_for_royalties = true OR ph.id IS NULL)
GROUP BY c.id, c.name, c.is_active
ORDER BY c.name;

COMMENT ON VIEW analytics_by_account IS
'Aggregated statistics per account: total venues, plays, seconds, unique users/songs';

-- ================================================
-- View 2: Analytics by Venue
-- ================================================
-- Statistics per individual venue/location
-- Used for venue-level reporting and performance comparison

CREATE OR REPLACE VIEW analytics_by_venue AS
SELECT
  c.id as account_id,
  c.name as account_name,
  l.id as venue_id,
  l.name as venue_name,
  l.city,
  l.is_active,
  COUNT(DISTINCT ph.id) as total_plays,
  SUM(ph.stream_duration) as total_seconds_played,
  COUNT(DISTINCT ph.user_id) as unique_users,
  COUNT(DISTINCT ph.song_id) as unique_songs,
  MAX(ph.played_at) as last_activity
FROM locations l
JOIN clients c ON l.client_id = c.id
LEFT JOIN play_history ph ON l.id = ph.location_id AND (ph.valid_for_royalties = true OR ph.id IS NULL)
GROUP BY c.id, c.name, l.id, l.name, l.city, l.is_active
ORDER BY c.name, l.name;

COMMENT ON VIEW analytics_by_venue IS
'Statistics per individual venue: plays, seconds, unique users/songs with parent account info';

-- ================================================
-- View 3: User Access Summary
-- ================================================
-- Shows user access levels with readable descriptions
-- Used in UserManager to display user access scope

CREATE OR REPLACE VIEW user_access_summary AS
SELECT
  up.id as user_id,
  up.full_name,
  up.email,
  up.role,
  up.access_level,
  up.is_active,
  c.id as account_id,
  c.name as account_name,
  l.id as venue_id,
  l.name as venue_name,
  CASE
    WHEN up.access_level = 'account' AND c.name IS NOT NULL THEN 'Todas las sedes de ' || c.name
    WHEN up.access_level = 'location' AND l.name IS NOT NULL THEN l.name || ' únicamente'
    WHEN up.role = 'admin' THEN 'Administrador - Acceso total'
    ELSE 'Sin acceso asignado'
  END as access_description
FROM user_profiles up
LEFT JOIN clients c ON up.client_id = c.id
LEFT JOIN locations l ON up.location_id = l.id
ORDER BY c.name NULLS LAST, l.name NULLS LAST, up.full_name;

COMMENT ON VIEW user_access_summary IS
'User access levels with readable descriptions showing account/venue assignments';

-- ================================================
-- Verification Queries
-- ================================================
-- Run these to verify the views work correctly

/*
-- Check account-level analytics
SELECT
  account_name,
  total_venues,
  total_plays,
  ROUND(total_seconds_played / 3600.0, 2) as hours_played
FROM analytics_by_account
WHERE is_active = true
ORDER BY total_plays DESC
LIMIT 10;

-- Check venue-level analytics
SELECT
  account_name,
  venue_name,
  city,
  total_plays,
  ROUND(total_seconds_played / 3600.0, 2) as hours_played
FROM analytics_by_venue
WHERE is_active = true
ORDER BY total_plays DESC
LIMIT 10;

-- Check user access summary
SELECT
  full_name,
  email,
  role,
  access_level,
  access_description
FROM user_access_summary
WHERE is_active = true
ORDER BY role, access_level;
*/
