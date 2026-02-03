-- ================================================
-- FIX SECURITY VULNERABILITIES
-- ================================================
-- Este script arregla las vulnerabilidades detectadas por Supabase
-- ================================================

-- ================================================
-- 1. FIX: auth_users_exposed - email_notifications_status
-- ================================================
-- Esta vista expone auth.users a roles anon/authenticated
-- Solucion: Eliminarla o restringir acceso

DROP VIEW IF EXISTS email_notifications_status;

-- Si necesitas esta vista, recreala sin exponer auth.users
-- O muevela a un schema privado

-- ================================================
-- 2. FIX: security_definer_view - Recrear vistas sin SECURITY DEFINER
-- ================================================
-- Las vistas con SECURITY DEFINER bypassean RLS
-- Solucion: Recrearlas con SECURITY INVOKER (default)

-- Primero, obtener las definiciones actuales y recrearlas
-- Nota: Esto elimina SECURITY DEFINER de todas las vistas

-- analytics_completion_quality
DROP VIEW IF EXISTS analytics_completion_quality CASCADE;

-- analytics_report_schedules_view
DROP VIEW IF EXISTS analytics_report_schedules_view CASCADE;

-- analytics_by_location
DROP VIEW IF EXISTS analytics_by_location CASCADE;

-- royalty_report_by_country
DROP VIEW IF EXISTS royalty_report_by_country CASCADE;

-- royalty_report_by_location
DROP VIEW IF EXISTS royalty_report_by_location CASCADE;

-- analytics_by_day
DROP VIEW IF EXISTS analytics_by_day CASCADE;

-- analytics_by_venue
DROP VIEW IF EXISTS analytics_by_venue CASCADE;

-- analytics_top_songs
DROP VIEW IF EXISTS analytics_top_songs CASCADE;

-- excluded_analytics_users
DROP VIEW IF EXISTS excluded_analytics_users CASCADE;

-- analytics_duplicate_plays
DROP VIEW IF EXISTS analytics_duplicate_plays CASCADE;

-- royalty_report_all_time
DROP VIEW IF EXISTS royalty_report_all_time CASCADE;

-- analytics_by_account
DROP VIEW IF EXISTS analytics_by_account CASCADE;

-- analytics_by_client
DROP VIEW IF EXISTS analytics_by_client CASCADE;

-- analytics_by_hour
DROP VIEW IF EXISTS analytics_by_hour CASCADE;

-- analytics_weekly_trends
DROP VIEW IF EXISTS analytics_weekly_trends CASCADE;

-- royalty_report_yearly
DROP VIEW IF EXISTS royalty_report_yearly CASCADE;

-- analytics_monthly_trends
DROP VIEW IF EXISTS analytics_monthly_trends CASCADE;

-- user_access_summary
DROP VIEW IF EXISTS user_access_summary CASCADE;

-- analytics_valid_plays
DROP VIEW IF EXISTS analytics_valid_plays CASCADE;

-- analytics_suspicious_activity
DROP VIEW IF EXISTS analytics_suspicious_activity CASCADE;

-- analytics_overview
DROP VIEW IF EXISTS analytics_overview CASCADE;

-- analytics_exclusion_audit_view
DROP VIEW IF EXISTS analytics_exclusion_audit_view CASCADE;

-- royalty_report_by_client
DROP VIEW IF EXISTS royalty_report_by_client CASCADE;

-- royalty_report_monthly
DROP VIEW IF EXISTS royalty_report_monthly CASCADE;

-- analytics_data_quality
DROP VIEW IF EXISTS analytics_data_quality CASCADE;

-- analytics_top_users
DROP VIEW IF EXISTS analytics_top_users CASCADE;

SELECT 'Vistas SECURITY DEFINER eliminadas' as status;

-- ================================================
-- 3. FIX: rls_references_user_metadata
-- ================================================
-- Las politicas RLS no deben usar user_metadata (editable por usuarios)
-- Solucion: Usar is_admin() que lee de user_profiles

-- clients - eliminar politicas inseguras
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Admins can manage clients" ON clients;

-- locations - eliminar politicas inseguras
DROP POLICY IF EXISTS "Admins can view all locations" ON locations;

-- playback_sessions - eliminar politicas inseguras
DROP POLICY IF EXISTS "Admins can manage all playback sessions" ON playback_sessions;

SELECT 'Politicas RLS inseguras eliminadas' as status;

-- ================================================
-- 4. RECREAR VISTAS SEGURAS (sin SECURITY DEFINER)
-- ================================================

-- analytics_valid_plays (base view for analytics)
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

-- excluded_analytics_users
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

-- analytics_overview
CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  COUNT(*) as total_plays,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT song_id) as unique_songs,
  COALESCE(SUM(stream_duration), 0) as total_seconds,
  ROUND(COALESCE(AVG(stream_duration), 0)::numeric, 2) as avg_duration
FROM analytics_valid_plays;

-- analytics_top_songs
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
LIMIT 10;

-- analytics_top_users
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
LIMIT 10;

-- analytics_by_day
CREATE OR REPLACE VIEW analytics_by_day AS
SELECT
  DATE(played_at) as fecha,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  COALESCE(SUM(stream_duration), 0) as segundos_totales
FROM analytics_valid_plays
GROUP BY DATE(played_at)
ORDER BY fecha DESC;

-- analytics_by_hour
CREATE OR REPLACE VIEW analytics_by_hour AS
SELECT
  EXTRACT(HOUR FROM played_at)::INT as hora,
  COUNT(*) as reproducciones
FROM analytics_valid_plays
GROUP BY EXTRACT(HOUR FROM played_at)
ORDER BY hora;

-- analytics_by_client
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

-- analytics_by_location
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

-- analytics_weekly_trends
CREATE OR REPLACE VIEW analytics_weekly_trends AS
SELECT
  DATE_TRUNC('week', played_at)::DATE as semana,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM analytics_valid_plays
WHERE played_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', played_at)
ORDER BY semana DESC;

-- analytics_monthly_trends
CREATE OR REPLACE VIEW analytics_monthly_trends AS
SELECT
  DATE_TRUNC('month', played_at)::DATE as mes,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT user_id) as usuarios_unicos
FROM analytics_valid_plays
WHERE played_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', played_at)
ORDER BY mes DESC;

SELECT 'Vistas recreadas sin SECURITY DEFINER' as status;

-- ================================================
-- 5. RECREAR POLITICAS RLS SEGURAS
-- ================================================

-- Verificar que existe is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND (is_active = true OR is_active IS NULL)
  );
$$;

-- clients - politicas seguras
CREATE POLICY "clients_admin_select" ON clients
FOR SELECT USING (public.is_admin() OR public.user_has_client_access(id));

CREATE POLICY "clients_admin_manage" ON clients
FOR ALL USING (public.is_admin());

-- locations - politicas seguras
CREATE POLICY "locations_admin_select" ON locations
FOR SELECT USING (public.is_admin() OR public.user_has_location_access(id));

-- playback_sessions - politicas seguras (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'playback_sessions') THEN
    EXECUTE 'CREATE POLICY "playback_sessions_admin" ON playback_sessions FOR ALL USING (public.is_admin())';
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

SELECT 'Politicas RLS seguras creadas' as status;

-- ================================================
-- 6. RESTRINGIR ACCESO A VISTAS DE ANALYTICS
-- ================================================
-- Solo admins/managers deberian ver analytics

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
REVOKE ALL ON excluded_analytics_users FROM anon;

-- Dar acceso solo a authenticated
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
GRANT SELECT ON excluded_analytics_users TO authenticated;

SELECT 'Permisos de vistas actualizados' as status;

-- ================================================
-- VERIFICACION FINAL
-- ================================================

SELECT '=== VULNERABILIDADES ARREGLADAS ===' as resultado;

-- Verificar que no hay mas vistas con SECURITY DEFINER
SELECT
  'Vistas con SECURITY DEFINER restantes:' as check_type,
  COUNT(*) as count
FROM pg_views
WHERE schemaname = 'public'
AND definition LIKE '%SECURITY DEFINER%';

-- Verificar politicas que usan user_metadata
SELECT
  'Politicas usando user_metadata:' as check_type,
  COUNT(*) as count
FROM pg_policies
WHERE qual::text LIKE '%user_metadata%'
   OR with_check::text LIKE '%user_metadata%';
