-- ================================================
-- DIAGNOSTICO DE ANALYTICS
-- ================================================
-- Ejecuta esto para ver qué está fallando
-- ================================================

-- 1. Verificar que las funciones existen
SELECT '=== FUNCIONES RPC ===' as info;
SELECT
  proname as funcion,
  pronargs as num_args
FROM pg_proc
WHERE proname IN (
  'get_analytics_overview_range',
  'get_top_songs_range',
  'get_analytics_by_day_range',
  'get_hourly_heatmap',
  'toggle_user_analytics_exclusion_v2'
)
ORDER BY proname;

-- 2. Verificar que las vistas existen
SELECT '=== VISTAS ===' as info;
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE 'analytics%'
ORDER BY table_name;

-- 3. Verificar las tablas base
SELECT '=== TABLAS BASE ===' as info;
SELECT
  'play_history' as tabla,
  (SELECT COUNT(*) FROM play_history) as registros;

SELECT
  'user_profiles' as tabla,
  (SELECT COUNT(*) FROM user_profiles) as registros;

SELECT
  'songs' as tabla,
  (SELECT COUNT(*) FROM songs) as registros;

-- 4. Verificar columnas de user_profiles
SELECT '=== COLUMNAS USER_PROFILES ===' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN ('exclude_from_analytics', 'is_active', 'role')
ORDER BY column_name;

-- 5. Probar función directamente (como postgres)
SELECT '=== TEST get_analytics_overview_range ===' as info;
SELECT * FROM get_analytics_overview_range(
  (CURRENT_DATE - INTERVAL '30 days')::DATE,
  CURRENT_DATE
);

-- 6. Probar get_top_songs_range
SELECT '=== TEST get_top_songs_range ===' as info;
SELECT * FROM get_top_songs_range(
  (CURRENT_DATE - INTERVAL '30 days')::DATE,
  CURRENT_DATE,
  5
) LIMIT 5;

-- 7. Verificar permisos en funciones
SELECT '=== PERMISOS FUNCIONES ===' as info;
SELECT
  p.proname as funcion,
  r.rolname as role_con_acceso
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_roles r ON has_function_privilege(r.oid, p.oid, 'EXECUTE')
WHERE n.nspname = 'public'
AND p.proname IN ('get_analytics_overview_range', 'get_top_songs_range')
AND r.rolname IN ('authenticated', 'anon', 'service_role')
ORDER BY p.proname, r.rolname;

-- 8. Verificar estructura de play_history
SELECT '=== COLUMNAS PLAY_HISTORY ===' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'play_history'
AND column_name IN ('user_id', 'song_id', 'stream_duration', 'completed', 'played_at', 'client_id', 'location_id')
ORDER BY column_name;

SELECT '=== DIAGNOSTICO COMPLETO ===' as resultado;
