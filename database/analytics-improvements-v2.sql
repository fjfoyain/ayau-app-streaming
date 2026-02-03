-- ================================================
-- Analytics Dashboard Improvements v2
-- ================================================
-- 1. User Exclusion Audit Log
-- 2. Dynamic Exclusion Reasons
-- 3. Data Quality / Anomaly Detection
-- 4. Custom Date Range Support
-- 5. Performance Indexes
-- 6. Role-Based Access
-- 7. Enhanced Export Functions
-- ================================================

-- ================================================
-- 1. USER EXCLUSION AUDIT LOG
-- Track all changes to user analytics exclusion
-- ================================================

CREATE TABLE IF NOT EXISTS public.analytics_exclusion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES user_profiles(id),
  action VARCHAR(20) NOT NULL CHECK (action IN ('EXCLUDED', 'INCLUDED')),
  reason VARCHAR(255),
  previous_reason VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_exclusion_audit_user_id ON analytics_exclusion_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_exclusion_audit_created_at ON analytics_exclusion_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exclusion_audit_changed_by ON analytics_exclusion_audit(changed_by);

-- View for audit log with user names
CREATE OR REPLACE VIEW public.analytics_exclusion_audit_view AS
SELECT
  aea.id,
  aea.user_id,
  up.email as user_email,
  up.full_name as user_name,
  aea.changed_by,
  cb.email as changed_by_email,
  cb.full_name as changed_by_name,
  aea.action,
  aea.reason,
  aea.previous_reason,
  aea.notes,
  aea.created_at
FROM analytics_exclusion_audit aea
JOIN user_profiles up ON aea.user_id = up.id
LEFT JOIN user_profiles cb ON aea.changed_by = cb.id
ORDER BY aea.created_at DESC;

-- ================================================
-- 2. DYNAMIC EXCLUSION REASONS (Predefined + Custom)
-- ================================================

CREATE TABLE IF NOT EXISTS public.exclusion_reason_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default exclusion reasons
INSERT INTO public.exclusion_reason_types (code, label, description, display_order) VALUES
  ('TEST_USER', 'Usuario de Prueba', 'Usuario creado para pruebas del sistema', 1),
  ('ADMIN_USER', 'Administrador', 'Usuario administrador del sistema', 2),
  ('INTERNAL_USER', 'Usuario Interno', 'Empleado interno de la empresa', 3),
  ('DEMO_USER', 'Usuario Demo', 'Usuario para demostraciones', 4),
  ('FRAUDULENT', 'Actividad Fraudulenta', 'Usuario con actividad sospechosa o fraudulenta', 5),
  ('BOT_DETECTED', 'Bot Detectado', 'Actividad automatizada detectada', 6),
  ('DUPLICATE_ACCOUNT', 'Cuenta Duplicada', 'Usuario con múltiples cuentas', 7),
  ('OTHER', 'Otro', 'Razón personalizada', 99)
ON CONFLICT (code) DO NOTHING;

-- Enhanced toggle function with audit logging
CREATE OR REPLACE FUNCTION public.toggle_user_analytics_exclusion_v2(
  p_user_id UUID,
  p_exclude BOOLEAN,
  p_reason_code VARCHAR DEFAULT NULL,
  p_custom_reason VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  exclude_from_analytics BOOLEAN,
  exclude_reason VARCHAR,
  audit_id UUID
) AS $$
DECLARE
  v_current_excluded BOOLEAN;
  v_current_reason VARCHAR;
  v_final_reason VARCHAR;
  v_audit_id UUID;
  v_changed_by UUID;
BEGIN
  -- Verify admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can modify user analytics exclusion';
  END IF;

  -- Get current state
  SELECT up.exclude_from_analytics, up.exclude_reason
  INTO v_current_excluded, v_current_reason
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Determine final reason
  IF p_reason_code IS NOT NULL THEN
    SELECT label INTO v_final_reason
    FROM exclusion_reason_types
    WHERE code = p_reason_code;

    IF p_custom_reason IS NOT NULL AND p_reason_code = 'OTHER' THEN
      v_final_reason := v_final_reason || ': ' || p_custom_reason;
    END IF;
  ELSE
    v_final_reason := p_custom_reason;
  END IF;

  -- Get current user ID
  v_changed_by := auth.uid();

  -- Update user profile
  UPDATE user_profiles
  SET
    exclude_from_analytics = p_exclude,
    exclude_reason = CASE WHEN p_exclude THEN v_final_reason ELSE NULL END
  WHERE id = p_user_id;

  -- Create audit log entry
  INSERT INTO analytics_exclusion_audit (
    user_id,
    changed_by,
    action,
    reason,
    previous_reason,
    notes
  ) VALUES (
    p_user_id,
    v_changed_by,
    CASE WHEN p_exclude THEN 'EXCLUDED' ELSE 'INCLUDED' END,
    v_final_reason,
    v_current_reason,
    p_notes
  ) RETURNING id INTO v_audit_id;

  RETURN QUERY
  SELECT
    up.id,
    up.exclude_from_analytics,
    up.exclude_reason,
    v_audit_id
  FROM user_profiles up
  WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 3. DATA QUALITY / ANOMALY DETECTION
-- ================================================

-- View: Data quality metrics
CREATE OR REPLACE VIEW public.analytics_data_quality AS
SELECT
  DATE(ph.played_at) as fecha,
  COUNT(*) as total_plays,
  -- Completion metrics
  COUNT(CASE WHEN ph.completed = true THEN 1 END) as completed_plays,
  ROUND(COUNT(CASE WHEN ph.completed = true THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as completion_rate,
  -- Duration anomalies
  COUNT(CASE WHEN ph.stream_duration < 5 THEN 1 END) as very_short_plays,
  COUNT(CASE WHEN ph.stream_duration > 600 THEN 1 END) as very_long_plays,
  ROUND(AVG(ph.stream_duration)::numeric, 1) as avg_duration,
  MIN(ph.stream_duration) as min_duration,
  MAX(ph.stream_duration) as max_duration,
  -- Potential duplicates (same user, same song, within 5 minutes)
  COUNT(DISTINCT ph.user_id) as unique_users,
  -- Missing data
  COUNT(CASE WHEN ph.song_id IS NULL THEN 1 END) as missing_song_id,
  COUNT(CASE WHEN ph.user_id IS NULL THEN 1 END) as missing_user_id,
  COUNT(CASE WHEN ph.location_id IS NULL THEN 1 END) as missing_location_id
FROM play_history ph
WHERE ph.played_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(ph.played_at)
ORDER BY fecha DESC;

-- View: Suspicious user activity (potential bots or fraud)
CREATE OR REPLACE VIEW public.analytics_suspicious_activity AS
SELECT
  ph.user_id,
  up.email,
  up.full_name,
  up.role,
  DATE(ph.played_at) as fecha,
  COUNT(*) as plays_count,
  COUNT(DISTINCT ph.song_id) as unique_songs,
  ROUND(AVG(ph.stream_duration)::numeric, 1) as avg_duration,
  MIN(ph.stream_duration) as min_duration,
  MAX(ph.stream_duration) as max_duration,
  -- Flags
  CASE
    WHEN COUNT(*) > 500 THEN 'HIGH_VOLUME'
    WHEN COUNT(*) > 200 THEN 'MEDIUM_VOLUME'
    ELSE 'NORMAL'
  END as volume_flag,
  CASE
    WHEN AVG(ph.stream_duration) < 10 THEN 'VERY_SHORT_AVG'
    WHEN AVG(ph.stream_duration) < 30 THEN 'SHORT_AVG'
    ELSE 'NORMAL'
  END as duration_flag,
  CASE
    WHEN COUNT(DISTINCT ph.song_id)::float / NULLIF(COUNT(*), 0) < 0.1 THEN 'REPETITIVE'
    ELSE 'NORMAL'
  END as repetition_flag
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
WHERE ph.played_at >= NOW() - INTERVAL '7 days'
  AND up.exclude_from_analytics = false
GROUP BY ph.user_id, up.email, up.full_name, up.role, DATE(ph.played_at)
HAVING COUNT(*) > 50
   OR AVG(ph.stream_duration) < 15
   OR (COUNT(DISTINCT ph.song_id)::float / NULLIF(COUNT(*), 0) < 0.1 AND COUNT(*) > 20)
ORDER BY plays_count DESC;

-- View: Duplicate plays detection
CREATE OR REPLACE VIEW public.analytics_duplicate_plays AS
SELECT
  ph.user_id,
  up.email,
  ph.song_id,
  s.title as song_title,
  COUNT(*) as play_count,
  MIN(ph.played_at) as first_play,
  MAX(ph.played_at) as last_play,
  EXTRACT(EPOCH FROM (MAX(ph.played_at) - MIN(ph.played_at))) as span_seconds
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
LEFT JOIN songs s ON ph.song_id = s.id
WHERE ph.played_at >= NOW() - INTERVAL '24 hours'
GROUP BY ph.user_id, up.email, ph.song_id, s.title
HAVING COUNT(*) > 5
   AND EXTRACT(EPOCH FROM (MAX(ph.played_at) - MIN(ph.played_at))) < 3600
ORDER BY play_count DESC;

-- ================================================
-- 4. CUSTOM DATE RANGE FUNCTIONS
-- ================================================

-- Function: Get analytics overview for custom date range
CREATE OR REPLACE FUNCTION public.get_analytics_overview_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  dias_con_actividad BIGINT,
  total_reproducciones BIGINT,
  usuarios_unicos BIGINT,
  canciones_reproducidas BIGINT,
  locales_activos BIGINT,
  horas_reproducidas NUMERIC,
  duracion_promedio_segundos NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT DATE(avp.played_at)),
    COUNT(*),
    COUNT(DISTINCT avp.user_id),
    COUNT(DISTINCT avp.song_id),
    COUNT(DISTINCT avp.location_id),
    ROUND(SUM(avp.stream_duration)::numeric / 3600, 2),
    ROUND(AVG(avp.stream_duration)::numeric, 0)
  FROM analytics_valid_plays avp
  WHERE DATE(avp.played_at) >= p_start_date
    AND DATE(avp.played_at) <= p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get top songs for custom date range
CREATE OR REPLACE FUNCTION public.get_top_songs_range(
  p_start_date DATE,
  p_end_date DATE,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  song_id UUID,
  song_title VARCHAR,
  performer VARCHAR,
  reproducciones BIGINT,
  usuarios_unicos BIGINT,
  horas_reproducidas NUMERIC,
  completitud_promedio_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    avp.song_id,
    avp.song_title::VARCHAR,
    avp.performer::VARCHAR,
    COUNT(*),
    COUNT(DISTINCT avp.user_id),
    ROUND(SUM(avp.stream_duration)::numeric / 3600, 2),
    ROUND(AVG(avp.stream_duration)::numeric / NULLIF(avp.duration, 0) * 100, 1)
  FROM analytics_valid_plays avp
  WHERE DATE(avp.played_at) >= p_start_date
    AND DATE(avp.played_at) <= p_end_date
    AND avp.song_id IS NOT NULL
  GROUP BY avp.song_id, avp.song_title, avp.performer, avp.duration
  ORDER BY COUNT(*) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get daily data for custom date range
CREATE OR REPLACE FUNCTION public.get_analytics_by_day_range(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  fecha DATE,
  dia_semana INT,
  nombre_dia TEXT,
  reproducciones BIGINT,
  usuarios_unicos BIGINT,
  canciones_unicas BIGINT,
  horas_reproducidas NUMERIC,
  duracion_promedio_segundos NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(avp.played_at),
    EXTRACT(DOW FROM avp.played_at)::INT,
    TO_CHAR(avp.played_at, 'Day'),
    COUNT(*),
    COUNT(DISTINCT avp.user_id),
    COUNT(DISTINCT avp.song_id),
    ROUND(SUM(avp.stream_duration)::numeric / 3600, 2),
    ROUND(AVG(avp.stream_duration)::numeric, 0)
  FROM analytics_valid_plays avp
  WHERE DATE(avp.played_at) >= p_start_date
    AND DATE(avp.played_at) <= p_end_date
  GROUP BY DATE(avp.played_at), EXTRACT(DOW FROM avp.played_at), TO_CHAR(avp.played_at, 'Day')
  ORDER BY DATE(avp.played_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get hourly heatmap data
CREATE OR REPLACE FUNCTION public.get_hourly_heatmap(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  dia_semana INT,
  nombre_dia TEXT,
  hora INT,
  reproducciones BIGINT,
  usuarios_unicos BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(DOW FROM avp.played_at)::INT,
    TO_CHAR(avp.played_at, 'Dy'),
    EXTRACT(HOUR FROM avp.played_at)::INT,
    COUNT(*),
    COUNT(DISTINCT avp.user_id)
  FROM analytics_valid_plays avp
  WHERE DATE(avp.played_at) >= p_start_date
    AND DATE(avp.played_at) <= p_end_date
  GROUP BY EXTRACT(DOW FROM avp.played_at), TO_CHAR(avp.played_at, 'Dy'), EXTRACT(HOUR FROM avp.played_at)
  ORDER BY EXTRACT(DOW FROM avp.played_at), EXTRACT(HOUR FROM avp.played_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 5. PERFORMANCE INDEXES
-- ================================================

-- Composite indexes for common queries (using played_at directly, not DATE())
-- PostgreSQL can use these indexes efficiently with date range queries
CREATE INDEX IF NOT EXISTS idx_play_history_played_at_user
  ON play_history(played_at, user_id);

CREATE INDEX IF NOT EXISTS idx_play_history_played_at_song
  ON play_history(played_at, song_id);

CREATE INDEX IF NOT EXISTS idx_play_history_played_at_location
  ON play_history(played_at, location_id);

CREATE INDEX IF NOT EXISTS idx_play_history_played_at_client
  ON play_history(played_at, client_id);

-- Index for completed plays (most common filter)
CREATE INDEX IF NOT EXISTS idx_play_history_completed_played_at
  ON play_history(completed, played_at DESC)
  WHERE completed = true;

-- Index for duration filtering
CREATE INDEX IF NOT EXISTS idx_play_history_duration
  ON play_history(stream_duration)
  WHERE stream_duration >= 30;

-- Index for user exclusion lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_exclude_analytics
  ON user_profiles(exclude_from_analytics)
  WHERE exclude_from_analytics = true;

-- ================================================
-- 6. ROLE-BASED ACCESS - RLS Policies
-- ================================================

-- Enable RLS on audit table
ALTER TABLE analytics_exclusion_audit ENABLE ROW LEVEL SECURITY;

-- Admin can see all audit entries
CREATE POLICY "admin_view_audit" ON analytics_exclusion_audit
  FOR SELECT USING (public.is_admin());

-- Admin can insert audit entries
CREATE POLICY "admin_insert_audit" ON analytics_exclusion_audit
  FOR INSERT WITH CHECK (public.is_admin());

-- Enable RLS on exclusion reasons
ALTER TABLE exclusion_reason_types ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view reasons
CREATE POLICY "authenticated_view_reasons" ON exclusion_reason_types
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admin can modify reasons
CREATE POLICY "admin_modify_reasons" ON exclusion_reason_types
  FOR ALL USING (public.is_admin());

-- ================================================
-- 7. ENHANCED EXPORT FUNCTIONS
-- ================================================

-- Function: Export with custom date range and filters
CREATE OR REPLACE FUNCTION public.export_analytics_filtered(
  p_start_date DATE,
  p_end_date DATE,
  p_format VARCHAR DEFAULT 'daily',
  p_client_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL
)
RETURNS TABLE (
  data JSON,
  generated_at TIMESTAMPTZ,
  format VARCHAR,
  filters JSON
) AS $$
DECLARE
  v_data JSON;
  v_filters JSON;
BEGIN
  v_filters := json_build_object(
    'start_date', p_start_date,
    'end_date', p_end_date,
    'client_id', p_client_id,
    'location_id', p_location_id
  );

  CASE p_format
    WHEN 'daily' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT
          DATE(avp.played_at) as fecha,
          TO_CHAR(avp.played_at, 'Day') as nombre_dia,
          COUNT(*) as reproducciones,
          COUNT(DISTINCT avp.user_id) as usuarios_unicos,
          COUNT(DISTINCT avp.song_id) as canciones_unicas,
          ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas
        FROM analytics_valid_plays avp
        WHERE DATE(avp.played_at) >= p_start_date
          AND DATE(avp.played_at) <= p_end_date
          AND (p_client_id IS NULL OR avp.client_id = p_client_id)
          AND (p_location_id IS NULL OR avp.location_id = p_location_id)
        GROUP BY DATE(avp.played_at), TO_CHAR(avp.played_at, 'Day')
        ORDER BY DATE(avp.played_at) DESC
      ) t;

    WHEN 'songs' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT
          avp.song_id,
          avp.song_title,
          avp.performer,
          COUNT(*) as reproducciones,
          COUNT(DISTINCT avp.user_id) as usuarios_unicos,
          ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas
        FROM analytics_valid_plays avp
        WHERE DATE(avp.played_at) >= p_start_date
          AND DATE(avp.played_at) <= p_end_date
          AND (p_client_id IS NULL OR avp.client_id = p_client_id)
          AND (p_location_id IS NULL OR avp.location_id = p_location_id)
          AND avp.song_id IS NOT NULL
        GROUP BY avp.song_id, avp.song_title, avp.performer
        ORDER BY COUNT(*) DESC
        LIMIT 100
      ) t;

    WHEN 'users' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT
          avp.user_id,
          avp.user_name,
          COUNT(*) as reproducciones,
          COUNT(DISTINCT avp.song_id) as canciones_unicas,
          ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas
        FROM analytics_valid_plays avp
        WHERE DATE(avp.played_at) >= p_start_date
          AND DATE(avp.played_at) <= p_end_date
          AND (p_client_id IS NULL OR avp.client_id = p_client_id)
          AND (p_location_id IS NULL OR avp.location_id = p_location_id)
        GROUP BY avp.user_id, avp.user_name
        ORDER BY COUNT(*) DESC
        LIMIT 100
      ) t;

    WHEN 'locations' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT
          avp.location_id,
          avp.location_name,
          avp.client_name,
          COUNT(*) as reproducciones,
          COUNT(DISTINCT avp.user_id) as usuarios_unicos,
          ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas
        FROM analytics_valid_plays avp
        WHERE DATE(avp.played_at) >= p_start_date
          AND DATE(avp.played_at) <= p_end_date
          AND (p_client_id IS NULL OR avp.client_id = p_client_id)
          AND (p_location_id IS NULL OR avp.location_id = p_location_id)
          AND avp.location_id IS NOT NULL
        GROUP BY avp.location_id, avp.location_name, avp.client_name
        ORDER BY COUNT(*) DESC
      ) t;

    WHEN 'hourly_heatmap' THEN
      SELECT json_agg(row_to_json(t)) INTO v_data
      FROM (
        SELECT * FROM get_hourly_heatmap(p_start_date, p_end_date)
      ) t;

    ELSE
      v_data := json_build_object('error', 'Invalid format');
  END CASE;

  RETURN QUERY SELECT v_data, NOW(), p_format, v_filters;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Export CSV with filters
CREATE OR REPLACE FUNCTION public.export_analytics_csv_filtered(
  p_start_date DATE,
  p_end_date DATE,
  p_format VARCHAR DEFAULT 'daily',
  p_client_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_csv TEXT;
  v_row RECORD;
BEGIN
  v_csv := '';

  CASE p_format
    WHEN 'daily' THEN
      v_csv := 'Fecha,Dia,Reproducciones,Usuarios Unicos,Canciones Unicas,Horas Reproducidas' || E'\n';
      FOR v_row IN
        SELECT
          DATE(avp.played_at) as fecha,
          TO_CHAR(avp.played_at, 'Day') as nombre_dia,
          COUNT(*) as reproducciones,
          COUNT(DISTINCT avp.user_id) as usuarios_unicos,
          COUNT(DISTINCT avp.song_id) as canciones_unicas,
          ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas
        FROM analytics_valid_plays avp
        WHERE DATE(avp.played_at) >= p_start_date
          AND DATE(avp.played_at) <= p_end_date
          AND (p_client_id IS NULL OR avp.client_id = p_client_id)
          AND (p_location_id IS NULL OR avp.location_id = p_location_id)
        GROUP BY DATE(avp.played_at), TO_CHAR(avp.played_at, 'Day')
        ORDER BY DATE(avp.played_at) DESC
      LOOP
        v_csv := v_csv || v_row.fecha || ',' || TRIM(v_row.nombre_dia) || ',' ||
                 v_row.reproducciones || ',' || v_row.usuarios_unicos || ',' ||
                 v_row.canciones_unicas || ',' || v_row.horas_reproducidas || E'\n';
      END LOOP;

    WHEN 'songs' THEN
      v_csv := 'Cancion,Artista,Reproducciones,Usuarios Unicos,Horas Reproducidas' || E'\n';
      FOR v_row IN
        SELECT
          avp.song_title,
          avp.performer,
          COUNT(*) as reproducciones,
          COUNT(DISTINCT avp.user_id) as usuarios_unicos,
          ROUND(SUM(avp.stream_duration)::numeric / 3600, 2) as horas_reproducidas
        FROM analytics_valid_plays avp
        WHERE DATE(avp.played_at) >= p_start_date
          AND DATE(avp.played_at) <= p_end_date
          AND (p_client_id IS NULL OR avp.client_id = p_client_id)
          AND (p_location_id IS NULL OR avp.location_id = p_location_id)
          AND avp.song_id IS NOT NULL
        GROUP BY avp.song_title, avp.performer
        ORDER BY COUNT(*) DESC
        LIMIT 100
      LOOP
        v_csv := v_csv || '"' || COALESCE(v_row.song_title, '') || '","' ||
                 COALESCE(v_row.performer, '') || '",' ||
                 v_row.reproducciones || ',' || v_row.usuarios_unicos || ',' ||
                 v_row.horas_reproducidas || E'\n';
      END LOOP;

    WHEN 'audit' THEN
      v_csv := 'Fecha,Usuario,Email,Accion,Razon,Modificado Por,Notas' || E'\n';
      FOR v_row IN
        SELECT * FROM analytics_exclusion_audit_view
        WHERE created_at >= p_start_date AND created_at <= p_end_date + INTERVAL '1 day'
        ORDER BY created_at DESC
      LOOP
        v_csv := v_csv || v_row.created_at || ',"' ||
                 COALESCE(v_row.user_name, '') || '","' ||
                 COALESCE(v_row.user_email, '') || '",' ||
                 v_row.action || ',"' ||
                 COALESCE(v_row.reason, '') || '","' ||
                 COALESCE(v_row.changed_by_name, 'Sistema') || '","' ||
                 COALESCE(v_row.notes, '') || '"' || E'\n';
      END LOOP;
  END CASE;

  RETURN v_csv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- VERIFICATION
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '=== Analytics Improvements v2 Applied ===';
  RAISE NOTICE '';
  RAISE NOTICE '1. User Exclusion Audit Log:';
  RAISE NOTICE '   - Table: analytics_exclusion_audit';
  RAISE NOTICE '   - View: analytics_exclusion_audit_view';
  RAISE NOTICE '';
  RAISE NOTICE '2. Dynamic Exclusion Reasons:';
  RAISE NOTICE '   - Table: exclusion_reason_types';
  RAISE NOTICE '   - Function: toggle_user_analytics_exclusion_v2()';
  RAISE NOTICE '';
  RAISE NOTICE '3. Data Quality Views:';
  RAISE NOTICE '   - analytics_data_quality';
  RAISE NOTICE '   - analytics_suspicious_activity';
  RAISE NOTICE '   - analytics_duplicate_plays';
  RAISE NOTICE '';
  RAISE NOTICE '4. Custom Date Range Functions:';
  RAISE NOTICE '   - get_analytics_overview_range()';
  RAISE NOTICE '   - get_top_songs_range()';
  RAISE NOTICE '   - get_analytics_by_day_range()';
  RAISE NOTICE '   - get_hourly_heatmap()';
  RAISE NOTICE '';
  RAISE NOTICE '5. Performance Indexes: Added 6 new indexes';
  RAISE NOTICE '';
  RAISE NOTICE '6. Role-Based Access: RLS policies for audit and reasons';
  RAISE NOTICE '';
  RAISE NOTICE '7. Enhanced Exports:';
  RAISE NOTICE '   - export_analytics_filtered()';
  RAISE NOTICE '   - export_analytics_csv_filtered()';
END $$;
