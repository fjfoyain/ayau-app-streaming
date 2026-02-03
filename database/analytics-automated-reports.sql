-- ================================================
-- Analytics Automated Reports System
-- ================================================
-- Scheduled email reports for analytics
-- ================================================

-- ================================================
-- 1. REPORT SCHEDULES TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.analytics_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Schedule configuration
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, for weekly
  day_of_month INT CHECK (day_of_month >= 1 AND day_of_month <= 28), -- for monthly
  hour_of_day INT DEFAULT 8 CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  timezone VARCHAR(50) DEFAULT 'America/Guatemala',

  -- Report configuration
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('summary', 'detailed', 'royalties', 'data_quality')),
  include_charts BOOLEAN DEFAULT true,
  include_excluded_users BOOLEAN DEFAULT false,

  -- Filters
  client_id UUID REFERENCES clients(id),
  location_id UUID REFERENCES locations(id),

  -- Recipients
  recipients JSONB NOT NULL DEFAULT '[]', -- Array of email addresses
  cc_recipients JSONB DEFAULT '[]',

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status VARCHAR(20),
  last_run_error TEXT,
  next_run_at TIMESTAMPTZ,

  -- Audit
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding schedules to run
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run
  ON analytics_report_schedules(next_run_at, is_active);

-- ================================================
-- 2. REPORT HISTORY TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS public.analytics_report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES analytics_report_schedules(id) ON DELETE CASCADE,

  -- Execution details
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,

  -- Report data
  report_period_start DATE,
  report_period_end DATE,
  report_data JSONB,

  -- Delivery
  recipients_sent JSONB,
  email_message_id VARCHAR(255)
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_report_history_schedule
  ON analytics_report_history(schedule_id, started_at DESC);

-- ================================================
-- 3. FUNCTIONS FOR REPORT SCHEDULING
-- ================================================

-- Function: Calculate next run time
CREATE OR REPLACE FUNCTION public.calculate_next_report_run(
  p_frequency VARCHAR,
  p_day_of_week INT,
  p_day_of_month INT,
  p_hour_of_day INT,
  p_timezone VARCHAR
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
  v_target_time TIME;
BEGIN
  v_now := NOW() AT TIME ZONE p_timezone;
  v_target_time := (p_hour_of_day || ':00:00')::TIME;

  CASE p_frequency
    WHEN 'daily' THEN
      -- Next occurrence at target hour
      v_next := DATE(v_now) + v_target_time;
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '1 day';
      END IF;

    WHEN 'weekly' THEN
      -- Next occurrence on target day of week
      v_next := DATE_TRUNC('week', v_now) + (p_day_of_week || ' days')::INTERVAL + v_target_time;
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '1 week';
      END IF;

    WHEN 'monthly' THEN
      -- Next occurrence on target day of month
      v_next := DATE_TRUNC('month', v_now) + ((p_day_of_month - 1) || ' days')::INTERVAL + v_target_time;
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '1 month';
      END IF;
  END CASE;

  RETURN v_next AT TIME ZONE p_timezone;
END;
$$ LANGUAGE plpgsql;

-- Function: Get report period based on frequency
CREATE OR REPLACE FUNCTION public.get_report_period(
  p_frequency VARCHAR,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (start_date DATE, end_date DATE) AS $$
BEGIN
  CASE p_frequency
    WHEN 'daily' THEN
      RETURN QUERY SELECT p_end_date - 1, p_end_date - 1;
    WHEN 'weekly' THEN
      RETURN QUERY SELECT p_end_date - 7, p_end_date - 1;
    WHEN 'monthly' THEN
      RETURN QUERY SELECT (DATE_TRUNC('month', p_end_date) - INTERVAL '1 month')::DATE,
                          (DATE_TRUNC('month', p_end_date) - INTERVAL '1 day')::DATE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function: Generate report data
CREATE OR REPLACE FUNCTION public.generate_report_data(
  p_report_type VARCHAR,
  p_start_date DATE,
  p_end_date DATE,
  p_client_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_include_excluded BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_data JSONB;
  v_overview JSONB;
  v_top_songs JSONB;
  v_top_users JSONB;
  v_by_day JSONB;
  v_by_location JSONB;
  v_excluded_users JSONB;
  v_data_quality JSONB;
BEGIN
  -- Get overview
  SELECT jsonb_agg(row_to_json(t))
  INTO v_overview
  FROM (
    SELECT * FROM get_analytics_overview_range(p_start_date, p_end_date)
  ) t;

  -- Get top songs
  SELECT jsonb_agg(row_to_json(t))
  INTO v_top_songs
  FROM (
    SELECT * FROM get_top_songs_range(p_start_date, p_end_date, 10)
  ) t;

  -- Get daily breakdown
  SELECT jsonb_agg(row_to_json(t))
  INTO v_by_day
  FROM (
    SELECT * FROM get_analytics_by_day_range(p_start_date, p_end_date)
  ) t;

  -- Get by location if not filtered
  IF p_location_id IS NULL THEN
    SELECT jsonb_agg(row_to_json(t))
    INTO v_by_location
    FROM (
      SELECT * FROM analytics_by_location LIMIT 20
    ) t;
  END IF;

  -- Include excluded users if requested
  IF p_include_excluded THEN
    SELECT jsonb_agg(row_to_json(t))
    INTO v_excluded_users
    FROM (
      SELECT * FROM excluded_analytics_users
    ) t;
  END IF;

  -- Include data quality for detailed reports
  IF p_report_type IN ('detailed', 'data_quality') THEN
    SELECT jsonb_agg(row_to_json(t))
    INTO v_data_quality
    FROM (
      SELECT * FROM analytics_data_quality
      WHERE fecha >= p_start_date AND fecha <= p_end_date
    ) t;
  END IF;

  -- Build final report
  v_data := jsonb_build_object(
    'generated_at', NOW(),
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'report_type', p_report_type,
    'overview', COALESCE(v_overview, '[]'::jsonb),
    'top_songs', COALESCE(v_top_songs, '[]'::jsonb),
    'by_day', COALESCE(v_by_day, '[]'::jsonb),
    'by_location', COALESCE(v_by_location, '[]'::jsonb)
  );

  IF p_include_excluded THEN
    v_data := v_data || jsonb_build_object('excluded_users', COALESCE(v_excluded_users, '[]'::jsonb));
  END IF;

  IF v_data_quality IS NOT NULL THEN
    v_data := v_data || jsonb_build_object('data_quality', v_data_quality);
  END IF;

  RETURN v_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 4. CRUD FUNCTIONS FOR SCHEDULES
-- ================================================

-- Create schedule
CREATE OR REPLACE FUNCTION public.create_report_schedule(
  p_name VARCHAR,
  p_description TEXT,
  p_frequency VARCHAR,
  p_report_type VARCHAR,
  p_recipients JSONB,
  p_day_of_week INT DEFAULT NULL,
  p_day_of_month INT DEFAULT NULL,
  p_hour_of_day INT DEFAULT 8,
  p_timezone VARCHAR DEFAULT 'America/Guatemala',
  p_client_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_include_charts BOOLEAN DEFAULT true,
  p_include_excluded BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_next_run TIMESTAMPTZ;
BEGIN
  -- Verify admin access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create report schedules';
  END IF;

  -- Calculate next run
  v_next_run := calculate_next_report_run(
    p_frequency,
    COALESCE(p_day_of_week, 1),
    COALESCE(p_day_of_month, 1),
    p_hour_of_day,
    p_timezone
  );

  INSERT INTO analytics_report_schedules (
    name, description, frequency, report_type, recipients,
    day_of_week, day_of_month, hour_of_day, timezone,
    client_id, location_id, include_charts, include_excluded_users,
    next_run_at, created_by
  ) VALUES (
    p_name, p_description, p_frequency, p_report_type, p_recipients,
    p_day_of_week, p_day_of_month, p_hour_of_day, p_timezone,
    p_client_id, p_location_id, p_include_charts, p_include_excluded,
    v_next_run, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update schedule
CREATE OR REPLACE FUNCTION public.update_report_schedule(
  p_id UUID,
  p_name VARCHAR DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_frequency VARCHAR DEFAULT NULL,
  p_report_type VARCHAR DEFAULT NULL,
  p_recipients JSONB DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update report schedules';
  END IF;

  UPDATE analytics_report_schedules SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    frequency = COALESCE(p_frequency, frequency),
    report_type = COALESCE(p_report_type, report_type),
    recipients = COALESCE(p_recipients, recipients),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = NOW()
  WHERE id = p_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete schedule
CREATE OR REPLACE FUNCTION public.delete_report_schedule(p_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete report schedules';
  END IF;

  DELETE FROM analytics_report_schedules WHERE id = p_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 5. VIEW FOR SCHEDULES WITH STATUS
-- ================================================

CREATE OR REPLACE VIEW public.analytics_report_schedules_view AS
SELECT
  s.*,
  u.email as created_by_email,
  u.full_name as created_by_name,
  CASE
    WHEN s.next_run_at <= NOW() THEN 'due'
    WHEN s.is_active = false THEN 'inactive'
    ELSE 'scheduled'
  END as schedule_status,
  (
    SELECT COUNT(*)
    FROM analytics_report_history h
    WHERE h.schedule_id = s.id
  ) as total_runs,
  (
    SELECT COUNT(*)
    FROM analytics_report_history h
    WHERE h.schedule_id = s.id AND h.status = 'completed'
  ) as successful_runs
FROM analytics_report_schedules s
LEFT JOIN user_profiles u ON s.created_by = u.id
ORDER BY s.next_run_at;

-- ================================================
-- 6. RLS POLICIES
-- ================================================

ALTER TABLE analytics_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_report_history ENABLE ROW LEVEL SECURITY;

-- Admin can manage schedules
CREATE POLICY "admin_manage_schedules" ON analytics_report_schedules
  FOR ALL USING (public.is_admin());

-- Admin can view history
CREATE POLICY "admin_view_history" ON analytics_report_history
  FOR SELECT USING (public.is_admin());

-- ================================================
-- VERIFICATION
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '=== Automated Reports System Created ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables:';
  RAISE NOTICE '  - analytics_report_schedules';
  RAISE NOTICE '  - analytics_report_history';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions:';
  RAISE NOTICE '  - calculate_next_report_run()';
  RAISE NOTICE '  - get_report_period()';
  RAISE NOTICE '  - generate_report_data()';
  RAISE NOTICE '  - create_report_schedule()';
  RAISE NOTICE '  - update_report_schedule()';
  RAISE NOTICE '  - delete_report_schedule()';
  RAISE NOTICE '';
  RAISE NOTICE 'Views:';
  RAISE NOTICE '  - analytics_report_schedules_view';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Email sending requires Edge Functions or external service';
END $$;
