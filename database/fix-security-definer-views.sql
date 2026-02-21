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

-- ================================================
-- ANALYTICS VIEWS
-- ================================================

ALTER VIEW public.analytics_valid_plays        SET (security_invoker = true);
ALTER VIEW public.excluded_analytics_users     SET (security_invoker = true);
ALTER VIEW public.analytics_overview           SET (security_invoker = true);
ALTER VIEW public.analytics_top_songs          SET (security_invoker = true);
ALTER VIEW public.analytics_top_users          SET (security_invoker = true);
ALTER VIEW public.analytics_by_day             SET (security_invoker = true);
ALTER VIEW public.analytics_by_hour            SET (security_invoker = true);
ALTER VIEW public.analytics_by_client          SET (security_invoker = true);
ALTER VIEW public.analytics_by_location        SET (security_invoker = true);
ALTER VIEW public.analytics_weekly_trends      SET (security_invoker = true);
ALTER VIEW public.analytics_monthly_trends     SET (security_invoker = true);
ALTER VIEW public.analytics_data_quality       SET (security_invoker = true);
ALTER VIEW public.analytics_suspicious_activity SET (security_invoker = true);
ALTER VIEW public.analytics_duplicate_plays    SET (security_invoker = true);
ALTER VIEW public.analytics_exclusion_audit_view SET (security_invoker = true);
ALTER VIEW public.analytics_completion_quality SET (security_invoker = true);

-- ================================================
-- ROYALTY REPORT VIEWS
-- ================================================

ALTER VIEW public.royalty_report_monthly       SET (security_invoker = true);
ALTER VIEW public.royalty_report_yearly        SET (security_invoker = true);
ALTER VIEW public.royalty_report_by_client     SET (security_invoker = true);
ALTER VIEW public.royalty_report_by_location   SET (security_invoker = true);
ALTER VIEW public.royalty_report_by_country    SET (security_invoker = true);
ALTER VIEW public.royalty_report_all_time      SET (security_invoker = true);

-- ================================================
-- PLAYLIST / ACCOUNT VIEWS
-- ================================================

ALTER VIEW public.accounts_with_playlists      SET (security_invoker = true);
ALTER VIEW public.locations_with_playlists     SET (security_invoker = true);

-- ================================================
-- ADDITIONAL VIEWS
-- ================================================

ALTER VIEW public.analytics_by_account         SET (security_invoker = true);
ALTER VIEW public.analytics_by_venue           SET (security_invoker = true);
ALTER VIEW public.user_access_summary          SET (security_invoker = true);
ALTER VIEW public.email_notifications_status   SET (security_invoker = true);
ALTER VIEW public.analytics_report_schedules_view SET (security_invoker = true);

-- ================================================
-- VERIFICATION
-- ================================================

SELECT
  viewname,
  CASE
    WHEN definition ILIKE '%security_invoker%' THEN 'has security_invoker in def'
    ELSE 'uses ALTER SET'
  END as method
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
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
    'royalty_report_monthly',
    'royalty_report_yearly',
    'royalty_report_by_client',
    'royalty_report_by_location',
    'royalty_report_by_country',
    'royalty_report_all_time',
    'accounts_with_playlists',
    'locations_with_playlists',
    'analytics_by_account',
    'analytics_by_venue',
    'user_access_summary',
    'email_notifications_status',
    'analytics_report_schedules_view'
  )
ORDER BY viewname;

-- Check reloptions to confirm security_invoker is set
SELECT
  c.relname AS viewname,
  c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN (
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
    'royalty_report_monthly',
    'royalty_report_yearly',
    'royalty_report_by_client',
    'royalty_report_by_location',
    'royalty_report_by_country',
    'royalty_report_all_time',
    'accounts_with_playlists',
    'locations_with_playlists',
    'analytics_by_account',
    'analytics_by_venue',
    'user_access_summary',
    'email_notifications_status',
    'analytics_report_schedules_view'
  )
ORDER BY c.relname;

DO $$
BEGIN
  RAISE NOTICE '=== Security Definer Views Fixed ===';
  RAISE NOTICE '';
  RAISE NOTICE 'All views now use security_invoker = true.';
  RAISE NOTICE 'Views will run with caller permissions, respecting RLS.';
  RAISE NOTICE '';
  RAISE NOTICE 'Re-run the Supabase Security Advisor to confirm 0 errors.';
END $$;
