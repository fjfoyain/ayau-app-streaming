-- ================================================
-- FIX: Security Definer Views
-- ================================================
-- Supabase Security Advisor flags views that run as
-- the view owner (superuser) bypassing RLS.
-- Fix: set security_invoker = true so views run with
-- the permissions of the CALLING user, respecting RLS.
--
-- Requires PostgreSQL 15+ (Supabase already uses 15+)
-- Run this in the Supabase SQL Editor.
-- ================================================

DO $$
DECLARE
  v_view TEXT;
  v_fixed INT := 0;
  v_skipped INT := 0;
  views_to_fix TEXT[] := ARRAY[
    -- Analytics views
    'analytics_valid_plays',
    'excluded_analytics_users',
    'analytics_overview',
    'analytics_top_songs',
    'analytics_top_users',
    'analytics_by_day',
    'analytics_by_hour',
    'analytics_by_client',
    'analytics_by_location',
    'analytics_weekly_trends',
    'analytics_monthly_trends',
    'analytics_data_quality',
    'analytics_suspicious_activity',
    'analytics_duplicate_plays',
    'analytics_exclusion_audit_view',
    'analytics_completion_quality',
    -- Royalty report views
    'royalty_report_monthly',
    'royalty_report_yearly',
    'royalty_report_by_client',
    'royalty_report_by_location',
    'royalty_report_by_country',
    'royalty_report_all_time',
    -- Playlist / account views
    'accounts_with_playlists',
    'locations_with_playlists',
    -- Optional views (may not be deployed)
    'analytics_by_account',
    'analytics_by_venue',
    'user_access_summary',
    'email_notifications_status',
    'analytics_report_schedules_view'
  ];
BEGIN
  FOREACH v_view IN ARRAY views_to_fix LOOP
    IF EXISTS (
      SELECT 1 FROM pg_views
      WHERE schemaname = 'public' AND viewname = v_view
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_view);
      RAISE NOTICE 'Fixed:   %', v_view;
      v_fixed := v_fixed + 1;
    ELSE
      RAISE NOTICE 'Skipped (not in DB): %', v_view;
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== Done: % fixed, % skipped ===', v_fixed, v_skipped;
  RAISE NOTICE 'Re-run the Supabase Security Advisor to confirm 0 errors.';
END $$;

-- ================================================
-- VERIFICATION
-- Check reloptions to confirm security_invoker is set
-- ================================================

SELECT
  c.relname AS viewname,
  c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.reloptions::text LIKE '%security_invoker%'
ORDER BY c.relname;
