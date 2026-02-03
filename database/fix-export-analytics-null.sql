-- ================================================
-- FIX: Export Analytics Functions
-- ================================================
-- Arreglar las funciones de exportación que devuelven null
-- ================================================

-- ================================================
-- 1. FUNCIÓN CSV MEJORADA
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
  v_count INTEGER := 0;
BEGIN
  -- Formato: daily
  IF p_format = 'daily' THEN
    -- Construir CSV
    WITH data_rows AS (
      SELECT
        DATE(ph.played_at) as fecha,
        COUNT(*) as reproducciones,
        COUNT(DISTINCT ph.user_id) as usuarios_unicos,
        ROUND(SUM(ph.stream_duration)::numeric / 3600, 2) as horas
      FROM play_history ph
      LEFT JOIN user_profiles up ON ph.user_id = up.id
      WHERE
        DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
        AND (ph.completed = true OR ph.stream_duration >= 30)
        AND (up.exclude_from_analytics IS NULL OR up.exclude_from_analytics = false)
        AND (p_client_id IS NULL OR ph.client_id = p_client_id)
        AND (p_location_id IS NULL OR ph.location_id = p_location_id)
      GROUP BY DATE(ph.played_at)
      ORDER BY fecha DESC
    )
    SELECT 
      'Fecha,Reproducciones,Usuarios Únicos,Horas' || E'\n' ||
      string_agg(
        fecha || ',' || reproducciones || ',' || usuarios_unicos || ',' || horas,
        E'\n'
      )
    INTO v_result
    FROM data_rows;

    -- Si no hay datos, devolver CSV vacío con headers
    IF v_result IS NULL THEN
      v_result := 'Fecha,Reproducciones,Usuarios Únicos,Horas' || E'\n' || 
                  'Sin datos para el rango seleccionado';
    END IF;

  -- Formato: songs
  ELSIF p_format = 'songs' THEN
    WITH data_rows AS (
      SELECT
        COALESCE(s.title, 'Desconocido') as cancion,
        COALESCE(s.performer, 'Desconocido') as artista,
        COUNT(*) as reproducciones,
        ROUND(SUM(ph.stream_duration)::numeric / 3600, 2) as horas
      FROM play_history ph
      LEFT JOIN user_profiles up ON ph.user_id = up.id
      LEFT JOIN songs s ON ph.song_id = s.id
      WHERE
        DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
        AND (ph.completed = true OR ph.stream_duration >= 30)
        AND (up.exclude_from_analytics IS NULL OR up.exclude_from_analytics = false)
        AND (p_client_id IS NULL OR ph.client_id = p_client_id)
        AND (p_location_id IS NULL OR ph.location_id = p_location_id)
      GROUP BY s.title, s.performer
      ORDER BY reproducciones DESC
      LIMIT 100
    )
    SELECT 
      'Canción,Artista,Reproducciones,Horas' || E'\n' ||
      string_agg(
        '"' || REPLACE(cancion, '"', '""') || '",' ||
        '"' || REPLACE(artista, '"', '""') || '",' ||
        reproducciones || ',' || horas,
        E'\n'
      )
    INTO v_result
    FROM data_rows;

    IF v_result IS NULL THEN
      v_result := 'Canción,Artista,Reproducciones,Horas' || E'\n' || 
                  'Sin datos para el rango seleccionado';
    END IF;

  -- Formato: audit (auditoría detallada)
  ELSIF p_format = 'audit' THEN
    WITH data_rows AS (
      SELECT
        DATE(ph.played_at) as fecha,
        up.email as usuario,
        COALESCE(s.title, 'Desconocido') as cancion,
        COALESCE(s.performer, 'Desconocido') as artista,
        ph.stream_duration as segundos,
        CASE WHEN ph.completed THEN 'Sí' ELSE 'No' END as completado,
        COALESCE(l.name, 'N/A') as local,
        COALESCE(c.name, 'N/A') as cuenta
      FROM play_history ph
      LEFT JOIN user_profiles up ON ph.user_id = up.id
      LEFT JOIN songs s ON ph.song_id = s.id
      LEFT JOIN locations l ON ph.location_id = l.id
      LEFT JOIN clients c ON ph.client_id = c.id
      WHERE
        DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
        AND (up.exclude_from_analytics IS NULL OR up.exclude_from_analytics = false)
        AND (p_client_id IS NULL OR ph.client_id = p_client_id)
        AND (p_location_id IS NULL OR ph.location_id = p_location_id)
      ORDER BY ph.played_at DESC
      LIMIT 1000
    )
    SELECT 
      'Fecha,Usuario,Canción,Artista,Segundos,Completado,Local,Cuenta' || E'\n' ||
      string_agg(
        fecha || ',' ||
        '"' || REPLACE(COALESCE(usuario, 'N/A'), '"', '""') || '",' ||
        '"' || REPLACE(cancion, '"', '""') || '",' ||
        '"' || REPLACE(artista, '"', '""') || '",' ||
        segundos || ',' ||
        completado || ',' ||
        '"' || REPLACE(local, '"', '""') || '",' ||
        '"' || REPLACE(cuenta, '"', '""') || '"',
        E'\n'
      )
    INTO v_result
    FROM data_rows;

    IF v_result IS NULL THEN
      v_result := 'Fecha,Usuario,Canción,Artista,Segundos,Completado,Local,Cuenta' || E'\n' || 
                  'Sin datos para el rango seleccionado';
    END IF;

  ELSE
    v_result := 'Error: Formato no soportado (' || p_format || ')' || E'\n' ||
                'Formatos válidos: daily, songs, audit';
  END IF;

  RETURN v_result;
END;
$$;

-- ================================================
-- 2. FUNCIÓN JSON MEJORADA
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
DECLARE
  v_result JSONB;
BEGIN
  -- Construir resultado
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'period', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date
    ),
    'filters', jsonb_build_object(
      'client_id', p_client_id,
      'location_id', p_location_id
    ),
    'data', (
      SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
      FROM (
        SELECT
          DATE(ph.played_at) as fecha,
          COUNT(*) as reproducciones,
          COUNT(DISTINCT ph.user_id) as usuarios_unicos,
          COUNT(DISTINCT ph.song_id) as canciones_unicas,
          ROUND(SUM(ph.stream_duration)::numeric / 3600, 2) as horas_reproducidas
        FROM play_history ph
        LEFT JOIN user_profiles up ON ph.user_id = up.id
        WHERE
          DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
          AND (ph.completed = true OR ph.stream_duration >= 30)
          AND (up.exclude_from_analytics IS NULL OR up.exclude_from_analytics = false)
          AND (p_client_id IS NULL OR ph.client_id = p_client_id)
          AND (p_location_id IS NULL OR ph.location_id = p_location_id)
        GROUP BY DATE(ph.played_at)
        ORDER BY fecha DESC
      ) sub
    ),
    'summary', (
      SELECT jsonb_build_object(
        'total_plays', COUNT(*),
        'total_hours', ROUND(SUM(ph.stream_duration)::numeric / 3600, 2),
        'unique_users', COUNT(DISTINCT ph.user_id),
        'unique_songs', COUNT(DISTINCT ph.song_id)
      )
      FROM play_history ph
      LEFT JOIN user_profiles up ON ph.user_id = up.id
      WHERE
        DATE(ph.played_at) BETWEEN p_start_date AND p_end_date
        AND (ph.completed = true OR ph.stream_duration >= 30)
        AND (up.exclude_from_analytics IS NULL OR up.exclude_from_analytics = false)
        AND (p_client_id IS NULL OR ph.client_id = p_client_id)
        AND (p_location_id IS NULL OR ph.location_id = p_location_id)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ================================================
-- GRANT PERMISSIONS
-- ================================================

GRANT EXECUTE ON FUNCTION export_analytics_csv_filtered(DATE, DATE, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION export_analytics_filtered(DATE, DATE, TEXT, UUID, UUID) TO authenticated;

-- ================================================
-- VERIFICACIÓN
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '=== Export Analytics Functions Fixed ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Funciones actualizadas:';
  RAISE NOTICE '  - export_analytics_csv_filtered()';
  RAISE NOTICE '  - export_analytics_filtered()';
  RAISE NOTICE '';
  RAISE NOTICE 'Mejoras:';
  RAISE NOTICE '  - Manejo correcto de datos nulos';
  RAISE NOTICE '  - Headers siempre incluidos en CSV';
  RAISE NOTICE '  - Mensaje cuando no hay datos';
  RAISE NOTICE '  - Formato audit agregado';
  RAISE NOTICE '  - JSON con resumen y metadatos';
END $$;
