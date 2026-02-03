-- ================================================
-- Mejora 2: Analytics Dashboard Mejorado
-- ================================================

-- ================================================
-- VISTA: Analytics General
-- ================================================

CREATE OR REPLACE VIEW public.analytics_overview AS
SELECT 
  COUNT(DISTINCT DATE(avp.played_at)) as dias_con_actividad,
  COUNT(*) as total_reproducciones,
  COUNT(DISTINCT avp.user_id) as usuarios_unicos,
  COUNT(DISTINCT avp.song_id) as canciones_reproducidas,
  COUNT(DISTINCT avp.location_id) as locales_activos,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas,
  ROUND(AVG(avp.stream_duration)::numeric, 0) as duracion_promedio_segundos,
  MAX(avp.played_at) as ultima_reproduccion
FROM analytics_valid_plays avp;

-- ================================================
-- VISTA: Top 10 Canciones
-- ================================================

CREATE OR REPLACE VIEW public.analytics_top_songs AS
SELECT 
  avp.song_id,
  avp.song_title,
  avp.performer,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT avp.user_id) as usuarios_unicos,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas,
  ROUND(AVG(avp.stream_duration)::numeric / avp.duration * 100, 1) as completitud_promedio_pct,
  MAX(avp.played_at) as ultima_reproduccion
FROM analytics_valid_plays avp
WHERE avp.song_id IS NOT NULL
GROUP BY avp.song_id, avp.song_title, avp.performer, avp.duration
ORDER BY reproducciones DESC
LIMIT 10;

-- ================================================
-- VISTA: Top 10 Usuarios Activos
-- ================================================

CREATE OR REPLACE VIEW public.analytics_top_users AS
SELECT 
  avp.user_id,
  avp.user_name,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT avp.song_id) as canciones_unicas,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas,
  MAX(avp.played_at) as ultima_reproduccion,
  (MAX(avp.played_at) - MIN(avp.played_at))::interval as rango_actividad
FROM analytics_valid_plays avp
GROUP BY avp.user_id, avp.user_name
ORDER BY reproducciones DESC
LIMIT 10;

-- ================================================
-- VISTA: Reproducciones por Hora (últimas 24h)
-- ================================================

CREATE OR REPLACE VIEW public.analytics_by_hour AS
SELECT 
  DATE_TRUNC('hour', avp.played_at) as hora,
  EXTRACT(HOUR FROM avp.played_at) as hora_del_dia,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT avp.user_id) as usuarios_unicos,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas
FROM analytics_valid_plays avp
WHERE avp.played_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', avp.played_at), EXTRACT(HOUR FROM avp.played_at)
ORDER BY hora DESC;

-- ================================================
-- VISTA: Reproducciones por Día (últimos 30 días)
-- ================================================

CREATE OR REPLACE VIEW public.analytics_by_day AS
SELECT 
  DATE(avp.played_at) as fecha,
  EXTRACT(DOW FROM avp.played_at)::INTEGER as dia_semana,
  TO_CHAR(avp.played_at, 'Day') as nombre_dia,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT avp.user_id) as usuarios_unicos,
  COUNT(DISTINCT avp.song_id) as canciones_unicas,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas,
  ROUND(AVG(avp.stream_duration)::numeric, 0) as duracion_promedio_segundos
FROM analytics_valid_plays avp
WHERE avp.played_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(avp.played_at), EXTRACT(DOW FROM avp.played_at), TO_CHAR(avp.played_at, 'Day')
ORDER BY fecha DESC;

-- ================================================
-- VISTA: Reproducciones por Cliente (Cuenta)
-- ================================================

CREATE OR REPLACE VIEW public.analytics_by_client AS
SELECT 
  avp.client_id,
  avp.client_name,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT avp.user_id) as usuarios_unicos,
  COUNT(DISTINCT avp.location_id) as locales_activos,
  COUNT(DISTINCT avp.song_id) as canciones_unicas,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas,
  MAX(avp.played_at) as ultima_reproduccion
FROM analytics_valid_plays avp
WHERE avp.client_id IS NOT NULL
GROUP BY avp.client_id, avp.client_name
ORDER BY reproducciones DESC;

-- ================================================
-- VISTA: Reproducciones por Ubicación (Local)
-- ================================================

CREATE OR REPLACE VIEW public.analytics_by_location AS
SELECT 
  avp.location_id,
  avp.location_name,
  avp.client_name,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT avp.user_id) as usuarios_unicos,
  COUNT(DISTINCT avp.song_id) as canciones_unicas,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas,
  MAX(avp.played_at) as ultima_reproduccion
FROM analytics_valid_plays avp
WHERE avp.location_id IS NOT NULL
GROUP BY avp.location_id, avp.location_name, avp.client_name
ORDER BY reproducciones DESC;

-- ================================================
-- VISTA: Tendencias Semanales
-- ================================================

CREATE OR REPLACE VIEW public.analytics_weekly_trends AS
SELECT 
  DATE_TRUNC('week', avp.played_at)::DATE as semana,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT avp.user_id) as usuarios_unicos,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas,
  ROUND(AVG(avp.stream_duration)::numeric, 0) as duracion_promedio
FROM analytics_valid_plays avp
WHERE avp.played_at >= NOW() - INTERVAL '13 weeks'
GROUP BY DATE_TRUNC('week', avp.played_at)
ORDER BY semana DESC;

-- ================================================
-- VISTA: Tendencias Mensuales
-- ================================================

CREATE OR REPLACE VIEW public.analytics_monthly_trends AS
SELECT 
  DATE_TRUNC('month', avp.played_at)::DATE as mes,
  TO_CHAR(avp.played_at, 'Month YYYY') as mes_nombre,
  COUNT(*) as reproducciones,
  COUNT(DISTINCT avp.user_id) as usuarios_unicos,
  COUNT(DISTINCT avp.song_id) as canciones_unicas,
  ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas,
  ROUND(AVG(avp.stream_duration)::numeric, 0) as duracion_promedio
FROM analytics_valid_plays avp
WHERE avp.played_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', avp.played_at), TO_CHAR(avp.played_at, 'Month YYYY')
ORDER BY mes DESC;

-- ================================================
-- VISTA: Calidad de Datos (Completitud de Streams)
-- ================================================

CREATE OR REPLACE VIEW public.analytics_completion_quality AS
SELECT 
  DATE(avp.played_at) as fecha,
  COUNT(*) as total_plays,
  COUNT(CASE WHEN avp.completed = true THEN 1 END) as plays_completados,
  ROUND(
    COUNT(CASE WHEN avp.completed = true THEN 1 END)::numeric / COUNT(*) * 100,
    1
  ) as tasa_completitud_pct,
  ROUND(
    (COUNT(CASE WHEN avp.completed = true THEN 1 END)::numeric / COUNT(*)) * 
    AVG(avp.stream_duration),
    0
  ) as duracion_promedio_completados_segundos
FROM analytics_valid_plays avp
WHERE avp.played_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(avp.played_at)
ORDER BY fecha DESC;

-- ================================================
-- FUNCIÓN: Exportar Analytics a JSON (para CSV)
-- ================================================

CREATE OR REPLACE FUNCTION public.export_analytics_json(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_format VARCHAR DEFAULT 'summary'  -- 'summary', 'daily', 'hourly', 'songs', 'users', 'locations'
)
RETURNS TABLE (
  data JSON,
  generated_at TIMESTAMPTZ,
  format VARCHAR
) AS $$
DECLARE
  v_data JSON;
BEGIN
  CASE p_format
    WHEN 'summary' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT *
        FROM analytics_overview
      ) t;
      
    WHEN 'daily' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT * FROM analytics_by_day
        WHERE fecha >= p_start_date AND fecha <= p_end_date
      ) t;
      
    WHEN 'hourly' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT * FROM analytics_by_hour
        WHERE hora >= p_start_date AND hora <= p_end_date
      ) t;
      
    WHEN 'songs' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT * FROM analytics_top_songs LIMIT 50
      ) t;
      
    WHEN 'users' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT * FROM analytics_top_users LIMIT 50
      ) t;
      
    WHEN 'locations' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT * FROM analytics_by_location
      ) t;
      
    ELSE
      v_data := json_build_object('error', 'Format no válido');
  END CASE;
  
  RETURN QUERY SELECT v_data, NOW(), p_format;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCIÓN: Generar CSV desde analytics
-- ================================================

CREATE OR REPLACE FUNCTION public.export_analytics_csv(
  p_format VARCHAR DEFAULT 'daily'
)
RETURNS TEXT AS $$
DECLARE
  v_csv TEXT;
  v_row RECORD;
BEGIN
  v_csv := '';
  
  CASE p_format
    WHEN 'daily' THEN
      v_csv := 'Fecha,Día,Reproducciones,Usuarios Únicos,Canciones Únicas,Horas Reproducidas,Duración Promedio (seg)' || E'\n';
      FOR v_row IN 
        SELECT * FROM analytics_by_day WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
      LOOP
        v_csv := v_csv || v_row.fecha || ',' || v_row.nombre_dia || ',' || 
                 v_row.reproducciones || ',' || v_row.usuarios_unicos || ',' ||
                 v_row.canciones_unicas || ',' || v_row.horas_reproducidas || ',' ||
                 v_row.duracion_promedio_segundos || E'\n';
      END LOOP;
      
    WHEN 'songs' THEN
      v_csv := 'Canción,Artista,Reproducciones,Usuarios Únicos,Horas Reproducidas,Completitud Promedio %' || E'\n';
      FOR v_row IN 
        SELECT * FROM analytics_top_songs LIMIT 100
      LOOP
        v_csv := v_csv || v_row.song_title || ',' || v_row.performer || ',' ||
                 v_row.reproducciones || ',' || v_row.usuarios_unicos || ',' ||
                 v_row.horas_reproducidas || ',' || v_row.completitud_promedio_pct || E'\n';
      END LOOP;
      
    WHEN 'locations' THEN
      v_csv := 'Ubicación,Cuenta,Reproducciones,Usuarios Únicos,Locales Activos,Horas Reproducidas' || E'\n';
      FOR v_row IN 
        SELECT * FROM analytics_by_location
      LOOP
        v_csv := v_csv || v_row.location_name || ',' || v_row.client_name || ',' ||
                 v_row.reproducciones || ',' || v_row.usuarios_unicos || ',' ||
                 v_row.locales_activos || ',' || v_row.horas_reproducidas || E'\n';
      END LOOP;
  END CASE;
  
  RETURN v_csv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ================================================
-- ASEGURAR COLUMNAS NECESARIAS EN play_history
-- ================================================

ALTER TABLE play_history
  ADD COLUMN IF NOT EXISTS exclude_from_analytics BOOLEAN DEFAULT false;



-- Índice compuesto para queries por fecha, usuario y localización (sin funciones no IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_analytics_valid_plays_compound
  ON play_history(played_at, user_id, location_id)
  WHERE exclude_from_analytics = false AND completed = true;

-- ================================================
-- VERIFICACIÓN
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Vistas de Analytics creadas:';
  RAISE NOTICE '  - analytics_overview (resumen general)';
  RAISE NOTICE '  - analytics_top_songs (top 10 canciones)';
  RAISE NOTICE '  - analytics_top_users (top 10 usuarios)';
  RAISE NOTICE '  - analytics_by_hour (reproducciones por hora)';
  RAISE NOTICE '  - analytics_by_day (reproducciones por día)';
  RAISE NOTICE '  - analytics_by_client (por cuenta)';
  RAISE NOTICE '  - analytics_by_location (por local)';
  RAISE NOTICE '  - analytics_weekly_trends (tendencias semanales)';
  RAISE NOTICE '  - analytics_monthly_trends (tendencias mensuales)';
  RAISE NOTICE '  - analytics_completion_quality (calidad de datos)';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Funciones de exportación:';
  RAISE NOTICE '  - export_analytics_json()';
  RAISE NOTICE '  - export_analytics_csv()';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Índices optimizados para queries rápidas';
END $$;

-- ================================================
-- TESTING QUERIES
-- ================================================

-- Ver resumen general
SELECT * FROM analytics_overview;

-- Ver top 10 canciones
SELECT * FROM analytics_top_songs;

-- Ver top 10 usuarios
SELECT * FROM analytics_top_users;

-- Ver reproducciones por hora (últimas 24h)
SELECT * FROM analytics_by_hour;

-- Ver reproducciones por día (últimos 30 días)
SELECT * FROM analytics_by_day;

-- Ver tendencias mensuales
SELECT * FROM analytics_monthly_trends;

-- Ver reproduciones por cliente
SELECT * FROM analytics_by_client;


-- Exportar a JSON (corregido: CAST a DATE)
SELECT data FROM public.export_analytics_json(
  (CURRENT_DATE - INTERVAL '7 days')::DATE,
  CURRENT_DATE::DATE,
  'daily'
);

-- Exportar a CSV (daily)
SELECT public.export_analytics_csv('daily');
