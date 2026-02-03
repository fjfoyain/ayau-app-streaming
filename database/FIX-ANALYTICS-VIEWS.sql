-- ================================================
-- RECREAR VISTAS DE ANALYTICS
-- ================================================
-- Ejecutar después de FIX-URGENTE-RECURSION.sql
-- ================================================

-- ================================================
-- 1. VISTA BASE: analytics_valid_plays
-- ================================================
CREATE OR REPLACE VIEW analytics_valid_plays AS
SELECT
  ph.id,
  ph.user_id,
  ph.song_id,
  ph.playlist_id,
  ph.location_id,
  ph.client_id,
  ph.stream_duration,
  ph.completed,
  ph.played_at,
  ph.country_code
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
WHERE
  up.exclude_from_analytics = false
  AND ph.completed = true
  AND ph.stream_duration >= 30;

-- ================================================
-- 2. VISTA: excluded_analytics_users
-- ================================================
CREATE OR REPLACE VIEW excluded_analytics_users AS
SELECT
  up.id,
  up.email,
  up.full_name,
  up.role,
  up.exclude_from_analytics,
  up.exclude_reason,
  up.created_at
FROM user_profiles up
WHERE up.exclude_from_analytics = true
ORDER BY up.created_at DESC;

-- ================================================
-- 3. VISTA: analytics_overview
-- ================================================
CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  COUNT(*) as total_plays,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT song_id) as unique_songs,
  COALESCE(SUM(stream_duration), 0) as total_seconds,
  ROUND(COALESCE(AVG(stream_duration), 0)::numeric, 2) as avg_duration
FROM analytics_valid_plays;

-- ================================================
-- 4. VISTA: analytics_top_songs
-- ================================================
CREATE OR REPLACE VIEW analytics_top_songs AS
SELECT
  s.id,
  s.title,
  s.performer,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN songs s ON avp.song_id = s.id
GROUP BY s.id, s.title, s.performer
ORDER BY play_count DESC
LIMIT 100;

-- ================================================
-- 5. VISTA: analytics_top_users
-- ================================================
CREATE OR REPLACE VIEW analytics_top_users AS
SELECT
  up.id,
  up.full_name,
  up.email,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN user_profiles up ON avp.user_id = up.id
GROUP BY up.id, up.full_name, up.email
ORDER BY play_count DESC
LIMIT 100;

-- ================================================
-- 6. VISTA: analytics_by_day
-- ================================================
CREATE OR REPLACE VIEW analytics_by_day AS
SELECT
  DATE(played_at) as fecha,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  COALESCE(SUM(stream_duration), 0) as segundos_totales
FROM analytics_valid_plays
GROUP BY DATE(played_at)
ORDER BY fecha DESC;

-- ================================================
-- 7. VISTA: analytics_by_hour
-- ================================================
CREATE OR REPLACE VIEW analytics_by_hour AS
SELECT
  EXTRACT(HOUR FROM played_at)::INT as hora,
  COUNT(*) as reproducciones
FROM analytics_valid_plays
GROUP BY EXTRACT(HOUR FROM played_at)
ORDER BY hora;

-- ================================================
-- 8. VISTA: analytics_by_client
-- ================================================
CREATE OR REPLACE VIEW analytics_by_client AS
SELECT
  c.id,
  c.name as client_name,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN clients c ON avp.client_id = c.id
GROUP BY c.id, c.name
ORDER BY play_count DESC;

-- ================================================
-- 9. VISTA: analytics_by_location
-- ================================================
CREATE OR REPLACE VIEW analytics_by_location AS
SELECT
  l.id,
  l.name as location_name,
  c.name as client_name,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN locations l ON avp.location_id = l.id
LEFT JOIN clients c ON l.client_id = c.id
GROUP BY l.id, l.name, c.name
ORDER BY play_count DESC;

-- ================================================
-- 10. VISTA: analytics_weekly_trends
-- ================================================
CREATE OR REPLACE VIEW analytics_weekly_trends AS
SELECT
  DATE_TRUNC('week', played_at)::DATE as semana,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM analytics_valid_plays
WHERE played_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', played_at)
ORDER BY semana DESC;

-- ================================================
-- 11. VISTA: analytics_monthly_trends
-- ================================================
CREATE OR REPLACE VIEW analytics_monthly_trends AS
SELECT
  DATE_TRUNC('month', played_at)::DATE as mes,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM analytics_valid_plays
WHERE played_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', played_at)
ORDER BY mes DESC;

-- ================================================
-- 12. VISTA: analytics_data_quality
-- ================================================
CREATE OR REPLACE VIEW analytics_data_quality AS
SELECT
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE stream_duration IS NULL) as null_duration,
  COUNT(*) FILTER (WHERE song_id IS NULL) as null_song,
  COUNT(*) FILTER (WHERE user_id IS NULL) as null_user,
  COUNT(*) FILTER (WHERE played_at IS NULL) as null_played_at,
  COUNT(*) FILTER (WHERE completed = false) as incomplete_plays,
  COUNT(*) FILTER (WHERE stream_duration < 30) as short_plays
FROM play_history;

-- ================================================
-- 13. VISTA: analytics_suspicious_activity
-- ================================================
CREATE OR REPLACE VIEW analytics_suspicious_activity AS
SELECT
  user_id,
  up.email,
  up.full_name,
  DATE(played_at) as fecha,
  COUNT(*) as plays_per_day,
  COUNT(DISTINCT song_id) as unique_songs
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
WHERE played_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, up.email, up.full_name, DATE(played_at)
HAVING COUNT(*) > 100
ORDER BY plays_per_day DESC;

-- ================================================
-- 14. VISTA: analytics_duplicate_plays
-- ================================================
CREATE OR REPLACE VIEW analytics_duplicate_plays AS
SELECT
  user_id,
  song_id,
  DATE(played_at) as fecha,
  COUNT(*) as play_count
FROM play_history
WHERE played_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id, song_id, DATE(played_at)
HAVING COUNT(*) > 5
ORDER BY play_count DESC;

-- ================================================
-- 15. VISTA: analytics_exclusion_audit_view
-- ================================================
CREATE OR REPLACE VIEW analytics_exclusion_audit_view AS
SELECT
  up.id,
  up.email,
  up.full_name,
  up.exclude_from_analytics,
  up.exclude_reason,
  up.updated_at as excluded_at,
  (SELECT COUNT(*) FROM play_history ph WHERE ph.user_id = up.id) as total_plays
FROM user_profiles up
WHERE up.exclude_from_analytics = true
ORDER BY up.updated_at DESC;

-- ================================================
-- 16. VISTA: analytics_completion_quality
-- ================================================
CREATE OR REPLACE VIEW analytics_completion_quality AS
SELECT
  DATE(played_at) as fecha,
  COUNT(*) as total_plays,
  COUNT(*) FILTER (WHERE completed = true) as completed_plays,
  COUNT(*) FILTER (WHERE completed = false) as incomplete_plays,
  ROUND(
    (COUNT(*) FILTER (WHERE completed = true)::numeric / NULLIF(COUNT(*), 0) * 100),
    2
  ) as completion_rate
FROM play_history
WHERE played_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(played_at)
ORDER BY fecha DESC;

-- ================================================
-- 17. VISTAS DE ROYALTY REPORTS
-- ================================================

CREATE OR REPLACE VIEW royalty_report_monthly AS
SELECT
  DATE_TRUNC('month', avp.played_at)::DATE as mes,
  s.id as song_id,
  s.title,
  s.performer,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN songs s ON avp.song_id = s.id
GROUP BY DATE_TRUNC('month', avp.played_at), s.id, s.title, s.performer
ORDER BY mes DESC, play_count DESC;

CREATE OR REPLACE VIEW royalty_report_yearly AS
SELECT
  DATE_TRUNC('year', avp.played_at)::DATE as ano,
  s.id as song_id,
  s.title,
  s.performer,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN songs s ON avp.song_id = s.id
GROUP BY DATE_TRUNC('year', avp.played_at), s.id, s.title, s.performer
ORDER BY ano DESC, play_count DESC;

CREATE OR REPLACE VIEW royalty_report_by_client AS
SELECT
  c.id as client_id,
  c.name as client_name,
  s.id as song_id,
  s.title,
  s.performer,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN songs s ON avp.song_id = s.id
JOIN clients c ON avp.client_id = c.id
GROUP BY c.id, c.name, s.id, s.title, s.performer
ORDER BY c.name, play_count DESC;

CREATE OR REPLACE VIEW royalty_report_by_location AS
SELECT
  l.id as location_id,
  l.name as location_name,
  c.name as client_name,
  s.id as song_id,
  s.title,
  s.performer,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN songs s ON avp.song_id = s.id
JOIN locations l ON avp.location_id = l.id
LEFT JOIN clients c ON l.client_id = c.id
GROUP BY l.id, l.name, c.name, s.id, s.title, s.performer
ORDER BY l.name, play_count DESC;

CREATE OR REPLACE VIEW royalty_report_by_country AS
SELECT
  COALESCE(avp.country_code, 'UNKNOWN') as country_code,
  s.id as song_id,
  s.title,
  s.performer,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN songs s ON avp.song_id = s.id
GROUP BY avp.country_code, s.id, s.title, s.performer
ORDER BY country_code, play_count DESC;

CREATE OR REPLACE VIEW royalty_report_all_time AS
SELECT
  s.id as song_id,
  s.title,
  s.performer,
  COUNT(*) as play_count,
  COALESCE(SUM(avp.stream_duration), 0) as total_seconds
FROM analytics_valid_plays avp
JOIN songs s ON avp.song_id = s.id
GROUP BY s.id, s.title, s.performer
ORDER BY play_count DESC;

-- ================================================
-- 18. PERMISOS PARA LAS VISTAS
-- ================================================

-- Revocar de anon
REVOKE ALL ON analytics_valid_plays FROM anon;
REVOKE ALL ON analytics_overview FROM anon;
REVOKE ALL ON analytics_top_songs FROM anon;
REVOKE ALL ON analytics_top_users FROM anon;
REVOKE ALL ON analytics_by_day FROM anon;
REVOKE ALL ON analytics_by_hour FROM anon;
REVOKE ALL ON analytics_by_client FROM anon;
REVOKE ALL ON analytics_by_location FROM anon;
REVOKE ALL ON analytics_weekly_trends FROM anon;
REVOKE ALL ON analytics_monthly_trends FROM anon;
REVOKE ALL ON analytics_data_quality FROM anon;
REVOKE ALL ON analytics_suspicious_activity FROM anon;
REVOKE ALL ON analytics_duplicate_plays FROM anon;
REVOKE ALL ON analytics_exclusion_audit_view FROM anon;
REVOKE ALL ON analytics_completion_quality FROM anon;
REVOKE ALL ON excluded_analytics_users FROM anon;
REVOKE ALL ON royalty_report_monthly FROM anon;
REVOKE ALL ON royalty_report_yearly FROM anon;
REVOKE ALL ON royalty_report_by_client FROM anon;
REVOKE ALL ON royalty_report_by_location FROM anon;
REVOKE ALL ON royalty_report_by_country FROM anon;
REVOKE ALL ON royalty_report_all_time FROM anon;

-- Dar acceso a authenticated
GRANT SELECT ON analytics_valid_plays TO authenticated;
GRANT SELECT ON analytics_overview TO authenticated;
GRANT SELECT ON analytics_top_songs TO authenticated;
GRANT SELECT ON analytics_top_users TO authenticated;
GRANT SELECT ON analytics_by_day TO authenticated;
GRANT SELECT ON analytics_by_hour TO authenticated;
GRANT SELECT ON analytics_by_client TO authenticated;
GRANT SELECT ON analytics_by_location TO authenticated;
GRANT SELECT ON analytics_weekly_trends TO authenticated;
GRANT SELECT ON analytics_monthly_trends TO authenticated;
GRANT SELECT ON analytics_data_quality TO authenticated;
GRANT SELECT ON analytics_suspicious_activity TO authenticated;
GRANT SELECT ON analytics_duplicate_plays TO authenticated;
GRANT SELECT ON analytics_exclusion_audit_view TO authenticated;
GRANT SELECT ON analytics_completion_quality TO authenticated;
GRANT SELECT ON excluded_analytics_users TO authenticated;
GRANT SELECT ON royalty_report_monthly TO authenticated;
GRANT SELECT ON royalty_report_yearly TO authenticated;
GRANT SELECT ON royalty_report_by_client TO authenticated;
GRANT SELECT ON royalty_report_by_location TO authenticated;
GRANT SELECT ON royalty_report_by_country TO authenticated;
GRANT SELECT ON royalty_report_all_time TO authenticated;

SELECT '=== VISTAS DE ANALYTICS RECREADAS ===' as resultado;

-- Verificar vistas creadas
SELECT
  'VISTAS CREADAS:' as info,
  table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE 'analytics%' OR table_name LIKE 'royalty%' OR table_name LIKE 'excluded%'
ORDER BY table_name;
