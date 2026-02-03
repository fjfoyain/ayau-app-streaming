-- TEST RAPIDO PARA VERIFICAR DATOS

-- 1. Contar registros en play_history
SELECT 'play_history total' as tabla, COUNT(*) as registros FROM play_history;

-- 2. Contar registros que cumplen los criterios de analytics
SELECT 'play_history validos (completed + >=30s)' as tipo,
       COUNT(*) as registros
FROM play_history
WHERE completed = true AND stream_duration >= 30;

-- 3. Verificar usuarios NO excluidos
SELECT 'usuarios NO excluidos' as tipo,
       COUNT(*) as registros
FROM user_profiles
WHERE exclude_from_analytics = false OR exclude_from_analytics IS NULL;

-- 4. Test directo de la funcion overview
SELECT 'TEST get_analytics_overview_range:' as test;
SELECT * FROM get_analytics_overview_range('2024-01-01'::DATE, CURRENT_DATE);

-- 5. Test directo de top songs
SELECT 'TEST get_top_songs_range:' as test;
SELECT * FROM get_top_songs_range('2024-01-01'::DATE, CURRENT_DATE, 5);

-- 6. Verificar si hay datos en las ultimas semanas
SELECT 'Ultimos 30 dias' as periodo,
       COUNT(*) as plays
FROM play_history
WHERE played_at >= NOW() - INTERVAL '30 days';
