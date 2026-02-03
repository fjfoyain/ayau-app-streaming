-- ================================================
-- FUNCIONES RPC PARA ANALYTICS
-- ================================================
-- Este script crea las funciones que el dashboard necesita
-- ================================================

-- ================================================
-- PRIMERO: ELIMINAR FUNCIONES EXISTENTES
-- ================================================
DROP FUNCTION IF EXISTS public.get_analytics_overview_range(DATE, DATE);
DROP FUNCTION IF EXISTS public.get_top_songs_range(DATE, DATE, INT);
DROP FUNCTION IF EXISTS public.get_analytics_by_day_range(DATE, DATE);
DROP FUNCTION IF EXISTS public.get_hourly_heatmap(DATE, DATE);
DROP FUNCTION IF EXISTS public.export_analytics_csv_filtered(DATE, DATE, TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.export_analytics_filtered(DATE, DATE, TEXT, UUID, UUID);

-- Eliminar TODAS las versiones de toggle_user_analytics_exclusion_v2
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT oid::regprocedure as func_signature
    FROM pg_proc
    WHERE proname = 'toggle_user_analytics_exclusion_v2'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- ================================================
-- 1. get_analytics_overview_range
-- ================================================
CREATE OR REPLACE FUNCTION public.get_analytics_overview_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_reproducciones BIGINT,
  usuarios_unicos BIGINT,
  horas_reproducidas NUMERIC,
  canciones_reproducidas BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_reproducciones,
    COUNT(DISTINCT ph.user_id)::BIGINT as usuarios_unicos,
    ROUND(COALESCE(SUM(ph.stream_duration), 0) / 3600.0, 2) as horas_reproducidas,
    COUNT(DISTINCT ph.song_id)::BIGINT as canciones_reproducidas
  FROM play_history ph
  JOIN user_profiles up ON ph.user_id = up.id
  WHERE
    up.exclude_from_analytics = false
    AND ph.completed = true
    AND ph.stream_duration >= 30
    AND DATE(ph.played_at) BETWEEN p_start_date AND p_end_date;
END;
$$;

-- ================================================
-- 2. get_top_songs_range
-- ================================================
CREATE OR REPLACE FUNCTION public.get_top_songs_range(
  p_start_date DATE,
  p_end_date DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  song_id UUID,
  song_title TEXT,
  performer TEXT,
  reproducciones BIGINT,
  usuarios_unicos BIGINT,
  horas_reproducidas NUMERIC,
  completitud_promedio_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as song_id,
    s.title::TEXT as song_title,
    s.performer::TEXT,
    COUNT(*)::BIGINT as reproducciones,
    COUNT(DISTINCT ph.user_id)::BIGINT as usuarios_unicos,
    ROUND(COALESCE(SUM(ph.stream_duration), 0) / 3600.0, 2) as horas_reproducidas,
    ROUND(AVG(LEAST(ph.stream_duration::numeric / NULLIF(s.duration, 0) * 100, 100)), 0) as completitud_promedio_pct
  FROM play_history ph
  JOIN user_profiles up ON ph.user_id = up.id
  JOIN songs s ON ph.song_id = s.id
  WHERE
    up.exclude_from_analytics = false
    AND ph.completed = true
    AND ph.stream_duration >= 30
    AND DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
  GROUP BY s.id, s.title, s.performer
  ORDER BY reproducciones DESC
  LIMIT p_limit;
END;
$$;

-- ================================================
-- 3. get_analytics_by_day_range
-- ================================================
CREATE OR REPLACE FUNCTION public.get_analytics_by_day_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  fecha DATE,
  reproducciones BIGINT,
  usuarios_unicos BIGINT,
  horas_reproducidas NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(ph.played_at) as fecha,
    COUNT(*)::BIGINT as reproducciones,
    COUNT(DISTINCT ph.user_id)::BIGINT as usuarios_unicos,
    ROUND(COALESCE(SUM(ph.stream_duration), 0) / 3600.0, 2) as horas_reproducidas
  FROM play_history ph
  JOIN user_profiles up ON ph.user_id = up.id
  WHERE
    up.exclude_from_analytics = false
    AND ph.completed = true
    AND ph.stream_duration >= 30
    AND DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(ph.played_at)
  ORDER BY fecha;
END;
$$;

-- ================================================
-- 4. get_hourly_heatmap
-- ================================================
CREATE OR REPLACE FUNCTION public.get_hourly_heatmap(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  hora INT,
  dia_semana INT,
  nombre_dia TEXT,
  reproducciones BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(HOUR FROM ph.played_at)::INT as hora,
    EXTRACT(DOW FROM ph.played_at)::INT as dia_semana,
    CASE EXTRACT(DOW FROM ph.played_at)::INT
      WHEN 0 THEN 'Dom'
      WHEN 1 THEN 'Lun'
      WHEN 2 THEN 'Mar'
      WHEN 3 THEN 'Mie'
      WHEN 4 THEN 'Jue'
      WHEN 5 THEN 'Vie'
      WHEN 6 THEN 'Sab'
    END as nombre_dia,
    COUNT(*)::BIGINT as reproducciones
  FROM play_history ph
  JOIN user_profiles up ON ph.user_id = up.id
  WHERE
    up.exclude_from_analytics = false
    AND ph.completed = true
    AND ph.stream_duration >= 30
    AND DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
  GROUP BY EXTRACT(HOUR FROM ph.played_at), EXTRACT(DOW FROM ph.played_at)
  ORDER BY dia_semana, hora;
END;
$$;

-- ================================================
-- 5. toggle_user_analytics_exclusion_v2
-- ================================================
CREATE OR REPLACE FUNCTION public.toggle_user_analytics_exclusion_v2(
  p_user_id UUID,
  p_exclude BOOLEAN,
  p_reason_code TEXT DEFAULT NULL,
  p_custom_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  -- Determinar la razón
  IF p_reason_code = 'OTHER' THEN
    v_reason := p_custom_reason;
  ELSE
    v_reason := p_reason_code;
  END IF;

  -- Actualizar usuario
  UPDATE user_profiles
  SET
    exclude_from_analytics = p_exclude,
    exclude_reason = CASE WHEN p_exclude THEN v_reason ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ================================================
-- 6. export_analytics_csv_filtered (placeholder)
-- ================================================
CREATE OR REPLACE FUNCTION public.export_analytics_csv_filtered(
  p_start_date DATE,
  p_end_date DATE,
  p_format TEXT,
  p_client_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result TEXT := '';
BEGIN
  IF p_format = 'daily' THEN
    SELECT string_agg(
      fecha || ',' || reproducciones || ',' || usuarios_unicos,
      E'\n'
    ) INTO v_result
    FROM (
      SELECT
        DATE(ph.played_at) as fecha,
        COUNT(*) as reproducciones,
        COUNT(DISTINCT ph.user_id) as usuarios_unicos
      FROM play_history ph
      JOIN user_profiles up ON ph.user_id = up.id
      WHERE
        up.exclude_from_analytics = false
        AND ph.completed = true
        AND ph.stream_duration >= 30
        AND DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
        AND (p_client_id IS NULL OR ph.client_id = p_client_id)
        AND (p_location_id IS NULL OR ph.location_id = p_location_id)
      GROUP BY DATE(ph.played_at)
      ORDER BY fecha
    ) sub;
    v_result := 'fecha,reproducciones,usuarios_unicos' || E'\n' || COALESCE(v_result, '');
  ELSIF p_format = 'songs' THEN
    SELECT string_agg(
      song_title || ',' || performer || ',' || reproducciones,
      E'\n'
    ) INTO v_result
    FROM (
      SELECT
        s.title::TEXT as song_title,
        s.performer::TEXT,
        COUNT(*) as reproducciones
      FROM play_history ph
      JOIN user_profiles up ON ph.user_id = up.id
      JOIN songs s ON ph.song_id = s.id
      WHERE
        up.exclude_from_analytics = false
        AND ph.completed = true
        AND ph.stream_duration >= 30
        AND DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
        AND (p_client_id IS NULL OR ph.client_id = p_client_id)
        AND (p_location_id IS NULL OR ph.location_id = p_location_id)
      GROUP BY s.title, s.performer
      ORDER BY reproducciones DESC
    ) sub;
    v_result := 'cancion,artista,reproducciones' || E'\n' || COALESCE(v_result, '');
  ELSE
    v_result := 'formato no soportado';
  END IF;

  RETURN v_result;
END;
$$;

-- ================================================
-- 7. export_analytics_filtered (JSON)
-- ================================================
CREATE OR REPLACE FUNCTION public.export_analytics_filtered(
  p_start_date DATE,
  p_end_date DATE,
  p_format TEXT,
  p_client_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(sub))
    FROM (
      SELECT
        DATE(ph.played_at) as fecha,
        COUNT(*) as reproducciones,
        COUNT(DISTINCT ph.user_id) as usuarios_unicos
      FROM play_history ph
      JOIN user_profiles up ON ph.user_id = up.id
      WHERE
        up.exclude_from_analytics = false
        AND ph.completed = true
        AND ph.stream_duration >= 30
        AND DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
        AND (p_client_id IS NULL OR ph.client_id = p_client_id)
        AND (p_location_id IS NULL OR ph.location_id = p_location_id)
      GROUP BY DATE(ph.played_at)
      ORDER BY fecha
    ) sub
  );
END;
$$;

-- ================================================
-- RECREAR VISTAS CON NOMBRES CORRECTOS
-- ================================================

-- analytics_top_users (con nombres que espera el frontend)
DROP VIEW IF EXISTS analytics_top_users CASCADE;
CREATE VIEW analytics_top_users AS
SELECT
  up.id as user_id,
  up.full_name as user_name,
  up.email,
  COUNT(*)::BIGINT as reproducciones,
  COUNT(DISTINCT ph.song_id)::BIGINT as canciones_unicas,
  ROUND(COALESCE(SUM(ph.stream_duration), 0) / 3600.0, 2) as horas_reproducidas
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
WHERE
  up.exclude_from_analytics = false
  AND ph.completed = true
  AND ph.stream_duration >= 30
GROUP BY up.id, up.full_name, up.email
ORDER BY reproducciones DESC
LIMIT 100;

-- analytics_by_hour
DROP VIEW IF EXISTS analytics_by_hour CASCADE;
CREATE VIEW analytics_by_hour AS
SELECT
  EXTRACT(HOUR FROM played_at)::INT as hora,
  COUNT(*) as reproducciones
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
WHERE
  up.exclude_from_analytics = false
  AND ph.completed = true
  AND ph.stream_duration >= 30
GROUP BY EXTRACT(HOUR FROM played_at)
ORDER BY hora;

-- analytics_weekly_trends
DROP VIEW IF EXISTS analytics_weekly_trends CASCADE;
CREATE VIEW analytics_weekly_trends AS
SELECT
  DATE_TRUNC('week', played_at)::DATE as semana,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT ph.user_id) as usuarios_unicos
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
WHERE
  up.exclude_from_analytics = false
  AND ph.completed = true
  AND ph.stream_duration >= 30
  AND played_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', played_at)
ORDER BY semana DESC;

-- analytics_monthly_trends
DROP VIEW IF EXISTS analytics_monthly_trends CASCADE;
CREATE VIEW analytics_monthly_trends AS
SELECT
  DATE_TRUNC('month', played_at)::DATE as mes,
  TO_CHAR(DATE_TRUNC('month', played_at), 'Mon YYYY') as mes_nombre,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT ph.user_id) as usuarios_unicos
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
WHERE
  up.exclude_from_analytics = false
  AND ph.completed = true
  AND ph.stream_duration >= 30
  AND played_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', played_at)
ORDER BY mes DESC;

-- analytics_by_client
DROP VIEW IF EXISTS analytics_by_client CASCADE;
CREATE VIEW analytics_by_client AS
SELECT
  c.id as client_id,
  c.name as client_name,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT ph.user_id) as usuarios_unicos
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
JOIN clients c ON ph.client_id = c.id
WHERE
  up.exclude_from_analytics = false
  AND ph.completed = true
  AND ph.stream_duration >= 30
GROUP BY c.id, c.name
ORDER BY reproducciones DESC;

-- analytics_by_location
DROP VIEW IF EXISTS analytics_by_location CASCADE;
CREATE VIEW analytics_by_location AS
SELECT
  l.id as location_id,
  l.name as location_name,
  c.name as client_name,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT ph.user_id) as usuarios_unicos
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
JOIN locations l ON ph.location_id = l.id
LEFT JOIN clients c ON l.client_id = c.id
WHERE
  up.exclude_from_analytics = false
  AND ph.completed = true
  AND ph.stream_duration >= 30
GROUP BY l.id, l.name, c.name
ORDER BY reproducciones DESC;

-- excluded_analytics_users
DROP VIEW IF EXISTS excluded_analytics_users CASCADE;
CREATE VIEW excluded_analytics_users AS
SELECT
  up.id,
  up.email,
  up.full_name,
  up.role,
  up.exclude_from_analytics,
  up.exclude_reason,
  up.created_at,
  (SELECT COUNT(*) FROM play_history ph WHERE ph.user_id = up.id) as total_plays
FROM user_profiles up
WHERE up.exclude_from_analytics = true
ORDER BY up.created_at DESC;

-- analytics_data_quality
DROP VIEW IF EXISTS analytics_data_quality CASCADE;
CREATE VIEW analytics_data_quality AS
SELECT
  DATE(played_at) as fecha,
  COUNT(*) as total_plays,
  COUNT(*) FILTER (WHERE completed = true) as completed_plays,
  ROUND(
    (COUNT(*) FILTER (WHERE completed = true)::numeric / NULLIF(COUNT(*), 0) * 100),
    2
  ) as completion_rate,
  COUNT(*) FILTER (WHERE stream_duration < 5) as very_short_plays,
  COUNT(*) FILTER (WHERE stream_duration > 600) as very_long_plays,
  COUNT(*) FILTER (WHERE song_id IS NULL) as missing_song_id
FROM play_history
WHERE played_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(played_at)
ORDER BY fecha DESC;

-- analytics_suspicious_activity
DROP VIEW IF EXISTS analytics_suspicious_activity CASCADE;
CREATE VIEW analytics_suspicious_activity AS
SELECT
  ph.user_id,
  up.email,
  up.full_name,
  DATE(ph.played_at) as fecha,
  COUNT(*) as plays_count,
  ROUND(AVG(ph.stream_duration)::numeric, 0) as avg_duration,
  CASE
    WHEN COUNT(*) > 200 THEN 'VERY_HIGH'
    WHEN COUNT(*) > 100 THEN 'HIGH'
    ELSE 'NORMAL'
  END as volume_flag,
  CASE
    WHEN AVG(ph.stream_duration) < 10 THEN 'TOO_SHORT'
    WHEN AVG(ph.stream_duration) > 500 THEN 'TOO_LONG'
    ELSE 'NORMAL'
  END as duration_flag,
  CASE
    WHEN COUNT(*) > COUNT(DISTINCT ph.song_id) * 3 THEN 'REPETITIVE'
    ELSE 'NORMAL'
  END as repetition_flag
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
WHERE ph.played_at >= NOW() - INTERVAL '30 days'
GROUP BY ph.user_id, up.email, up.full_name, DATE(ph.played_at)
HAVING COUNT(*) > 50
   OR AVG(ph.stream_duration) < 10
   OR AVG(ph.stream_duration) > 500
ORDER BY plays_count DESC;

-- analytics_duplicate_plays
DROP VIEW IF EXISTS analytics_duplicate_plays CASCADE;
CREATE VIEW analytics_duplicate_plays AS
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

-- analytics_exclusion_audit_view
DROP VIEW IF EXISTS analytics_exclusion_audit_view CASCADE;
CREATE VIEW analytics_exclusion_audit_view AS
SELECT
  up.id,
  up.id as user_id,
  up.full_name as user_name,
  up.email as user_email,
  CASE WHEN up.exclude_from_analytics THEN 'EXCLUDED' ELSE 'INCLUDED' END as action,
  up.exclude_reason as reason,
  NULL::TEXT as changed_by_name,
  NULL::TEXT as notes,
  up.updated_at as created_at
FROM user_profiles up
WHERE up.exclude_from_analytics = true
ORDER BY up.updated_at DESC;

-- ================================================
-- CREAR TABLA exclusion_reason_types SI NO EXISTE
-- ================================================
CREATE TABLE IF NOT EXISTS exclusion_reason_types (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0
);

-- Insertar razones predefinidas
INSERT INTO exclusion_reason_types (code, label, description, display_order)
VALUES
  ('TEST_USER', 'Usuario de Prueba', 'Cuentas utilizadas para testing', 1),
  ('INTERNAL', 'Usuario Interno', 'Empleados o staff de la empresa', 2),
  ('BOT', 'Bot/Automatizado', 'Actividad automatizada detectada', 3),
  ('FRAUD', 'Fraude', 'Actividad fraudulenta detectada', 4),
  ('DUPLICATE', 'Cuenta Duplicada', 'Cuenta duplicada de otro usuario', 5),
  ('OTHER', 'Otro', 'Otra razón (especificar)', 99)
ON CONFLICT (code) DO NOTHING;

-- ================================================
-- PERMISOS
-- ================================================
GRANT SELECT ON analytics_top_users TO authenticated;
GRANT SELECT ON analytics_by_hour TO authenticated;
GRANT SELECT ON analytics_weekly_trends TO authenticated;
GRANT SELECT ON analytics_monthly_trends TO authenticated;
GRANT SELECT ON analytics_by_client TO authenticated;
GRANT SELECT ON analytics_by_location TO authenticated;
GRANT SELECT ON excluded_analytics_users TO authenticated;
GRANT SELECT ON analytics_data_quality TO authenticated;
GRANT SELECT ON analytics_suspicious_activity TO authenticated;
GRANT SELECT ON analytics_duplicate_plays TO authenticated;
GRANT SELECT ON analytics_exclusion_audit_view TO authenticated;
GRANT SELECT ON exclusion_reason_types TO authenticated;

-- Permisos para funciones
GRANT EXECUTE ON FUNCTION get_analytics_overview_range(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_songs_range(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_by_day_range(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_heatmap(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_user_analytics_exclusion_v2(UUID, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION export_analytics_csv_filtered(DATE, DATE, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION export_analytics_filtered(DATE, DATE, TEXT, UUID, UUID) TO authenticated;

SELECT '=== FUNCIONES Y VISTAS DE ANALYTICS CREADAS ===' as resultado;
