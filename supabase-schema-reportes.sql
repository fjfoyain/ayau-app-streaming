-- ================================================
-- AYAU Music Streaming - Schema con Énfasis en Reportes de Regalías
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- TABLES
-- ================================================

-- Clients (Empresas/Organizaciones)
-- Ejemplo: "Restaurante Don Pepe", "Café Barista", etc.
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  tax_id VARCHAR(50), -- NIT o identificación fiscal
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations (Locales/Sucursales de cada cliente)
-- Ejemplo: "Don Pepe Zona 10", "Don Pepe Carretera El Salvador", etc.
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country_code VARCHAR(2) DEFAULT 'GT',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles (Extensión de auth.users)
-- Vincula usuarios de Supabase Auth con locales
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'staff', -- 'staff', 'manager', 'admin'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlists table (ANTES de playback_sessions)
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs table (con campos críticos para regalías) (ANTES de playback_sessions)
CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Información básica
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255), -- Compositor/Autor (quien recibe regalías de composición)
  performer VARCHAR(255), -- Intérprete/Artista (quien recibe regalías de interpretación)
  album VARCHAR(255),

  -- Duración (CRÍTICO para calcular % reproducido)
  duration INTEGER NOT NULL, -- Duración total en segundos

  -- URLs de archivos
  file_url TEXT NOT NULL,
  cover_image_url TEXT,

  -- Códigos para reportes (CRÍTICO para identificación única)
  isrc VARCHAR(12), -- International Standard Recording Code (obligatorio para reportes)
  iswc VARCHAR(15), -- International Standard Musical Work Code (composición)
  ipi VARCHAR(11), -- Interested Parties Information (código de compositor)
  code VARCHAR(50), -- Código interno de AYAU

  -- Metadata adicional
  genre VARCHAR(100),
  release_year INTEGER,
  label VARCHAR(255),
  version VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playlist-Songs junction table
CREATE TABLE playlist_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, song_id)
);

-- Playback Sessions (Control centralizado de reproducción)
-- Permite que un cliente controle la música de todas sus sucursales desde un punto central
-- DEBE IR DESPUÉS de songs y playlists porque hace referencia a ellos
CREATE TABLE playback_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  -- Control de reproducción
  is_centralized BOOLEAN DEFAULT false, -- true = control centralizado, false = cada local independiente
  current_song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  current_playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,

  -- Estado del reproductor
  playback_state VARCHAR(20) DEFAULT 'stopped', -- 'playing', 'paused', 'stopped'
  playback_position INTEGER DEFAULT 0, -- Segundos en la canción actual
  volume INTEGER DEFAULT 70, -- Volumen (0-100)

  -- Control de sesión
  controlled_by UUID REFERENCES auth.users(id), -- Usuario que controla actualmente

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id) -- Un cliente solo tiene una sesión de playback
);

-- ================================================
-- TABLA CRÍTICA: Play History (registro de cada reproducción)
-- ================================================
-- Cada vez que un usuario reproduce una canción, se guarda un registro aquí

CREATE TABLE play_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Referencias
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,

  -- NUEVO: Referencias a cliente y local (para reportes por negocio)
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- CRÍTICO: Segundos reproducidos
  stream_duration INTEGER DEFAULT 0, -- Cuántos segundos se reprodujo esta vez

  -- Validación de stream completo
  -- (Algunas sociedades de regalías solo cuentan streams >30 segundos o >50% de la canción)
  completed BOOLEAN DEFAULT false, -- true si se reprodujo >50% de la duración
  valid_for_royalties BOOLEAN DEFAULT false, -- true si cumple criterios mínimos (>30 seg)

  -- Geolocalización (algunas regalías varían por país)
  country_code VARCHAR(2), -- ISO 3166-1 alpha-2 (ej: "GT" para Guatemala)

  -- Timestamp
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance de reportes
CREATE INDEX idx_play_history_song_date ON play_history(song_id, played_at DESC);
CREATE INDEX idx_play_history_valid ON play_history(valid_for_royalties) WHERE valid_for_royalties = true;
CREATE INDEX idx_play_history_location ON play_history(location_id);
CREATE INDEX idx_play_history_client ON play_history(client_id);

-- ================================================
-- TABLA: Stream Analytics Agregados (Reportes Mensuales)
-- ================================================
-- Esta tabla se actualiza automáticamente cada mes para tener reportes rápidos

CREATE TABLE stream_analytics_monthly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,

  -- Periodo del reporte
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12

  -- Métricas CRÍTICAS para regalías
  total_streams INTEGER DEFAULT 0, -- Total de reproducciones (cualquier duración)
  total_valid_streams INTEGER DEFAULT 0, -- Reproducciones válidas (>30 seg)
  total_completed_streams INTEGER DEFAULT 0, -- Reproducciones completas (>50%)

  -- TOTAL DE SEGUNDOS REPRODUCIDOS (para regalías proporcionales)
  total_seconds_played INTEGER DEFAULT 0, -- Suma de todos los stream_duration

  -- Usuarios únicos
  unique_listeners INTEGER DEFAULT 0,

  -- Segundos por país (JSON: {"GT": 12450, "SV": 8900, ...})
  seconds_by_country JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(song_id, year, month)
);

-- User permissions para playlists
CREATE TABLE playlist_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  permission_level VARCHAR(20) DEFAULT 'viewer',
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, playlist_id)
);

-- ================================================
-- FUNCIONES PARA TRACKING AUTOMÁTICO
-- ================================================

-- Función: Marcar stream como válido para regalías
CREATE OR REPLACE FUNCTION mark_stream_validity()
RETURNS TRIGGER AS $$
DECLARE
  song_duration INTEGER;
BEGIN
  -- Obtener duración de la canción
  SELECT duration INTO song_duration
  FROM songs
  WHERE id = NEW.song_id;

  -- Marcar como completado si >50% de la duración
  NEW.completed := (NEW.stream_duration::float / song_duration::float) > 0.5;

  -- Marcar como válido para regalías si >30 segundos
  NEW.valid_for_royalties := NEW.stream_duration >= 30;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_stream_validity
  BEFORE INSERT ON play_history
  FOR EACH ROW
  EXECUTE FUNCTION mark_stream_validity();

-- ================================================
-- Función: Agregar analytics mensuales
-- ================================================
-- Esta función se debe ejecutar automáticamente el primer día de cada mes
-- Para agregar los datos del mes anterior

CREATE OR REPLACE FUNCTION aggregate_monthly_analytics(target_year INT, target_month INT)
RETURNS TABLE(
  songs_processed INT,
  total_seconds_aggregated BIGINT
) AS $$
DECLARE
  processed_count INT := 0;
  total_seconds BIGINT := 0;
BEGIN
  -- Borrar datos existentes para este periodo (por si se re-ejecuta)
  DELETE FROM stream_analytics_monthly
  WHERE year = target_year AND month = target_month;

  -- Insertar datos agregados
  INSERT INTO stream_analytics_monthly (
    song_id,
    year,
    month,
    total_streams,
    total_valid_streams,
    total_completed_streams,
    total_seconds_played,
    unique_listeners,
    seconds_by_country
  )
  SELECT
    song_id,
    target_year,
    target_month,
    COUNT(*) as total_streams,
    COUNT(*) FILTER (WHERE valid_for_royalties = true) as total_valid_streams,
    COUNT(*) FILTER (WHERE completed = true) as total_completed_streams,
    SUM(stream_duration) as total_seconds_played,
    COUNT(DISTINCT user_id) as unique_listeners,
    (
      SELECT jsonb_object_agg(country_code, country_seconds)
      FROM (
        SELECT
          COALESCE(country_code, 'UNKNOWN') as country_code,
          SUM(stream_duration) as country_seconds
        FROM play_history ph2
        WHERE ph2.song_id = ph.song_id
        AND EXTRACT(YEAR FROM ph2.played_at) = target_year
        AND EXTRACT(MONTH FROM ph2.played_at) = target_month
        GROUP BY country_code
      ) country_stats
    ) as seconds_by_country
  FROM play_history ph
  WHERE EXTRACT(YEAR FROM played_at) = target_year
  AND EXTRACT(MONTH FROM played_at) = target_month
  GROUP BY song_id;

  -- Obtener estadísticas de la agregación
  GET DIAGNOSTICS processed_count = ROW_COUNT;

  SELECT SUM(total_seconds_played) INTO total_seconds
  FROM stream_analytics_monthly
  WHERE year = target_year AND month = target_month;

  RETURN QUERY SELECT processed_count, total_seconds;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- VIEWS PARA REPORTES
-- ================================================

-- View 1: Reporte General (todas las canciones, todos los tiempos)
CREATE OR REPLACE VIEW royalty_report_all_time AS
SELECT
  s.id,
  s.title,
  s.performer,
  s.author,
  s.isrc,
  s.iswc,
  s.ipi,
  s.code,
  s.duration as song_duration_seconds,

  -- Totales de todos los tiempos
  COUNT(ph.id) as total_plays,
  COUNT(ph.id) FILTER (WHERE ph.valid_for_royalties = true) as valid_plays,
  COALESCE(SUM(ph.stream_duration), 0) as total_seconds_played,
  COUNT(DISTINCT ph.user_id) as unique_listeners,

  -- Promedio de reproducción
  ROUND(AVG(ph.stream_duration)::numeric, 2) as avg_seconds_per_play,

  -- Porcentaje de reproducción promedio
  ROUND((AVG(ph.stream_duration)::numeric / s.duration::numeric) * 100, 2) as avg_completion_percentage,

  -- Última reproducción
  MAX(ph.played_at) as last_played_at

FROM songs s
LEFT JOIN play_history ph ON s.id = ph.song_id
GROUP BY s.id
ORDER BY total_seconds_played DESC;

-- View 2: Reporte Mensual (datos agregados)
CREATE OR REPLACE VIEW royalty_report_monthly AS
SELECT
  sam.year,
  sam.month,
  s.id as song_id,
  s.title,
  s.performer,
  s.author,
  s.isrc,
  s.iswc,
  s.ipi,
  s.code,
  s.duration as song_duration_seconds,

  -- Métricas del mes
  sam.total_streams,
  sam.total_valid_streams,
  sam.total_completed_streams,
  sam.total_seconds_played,
  sam.unique_listeners,
  sam.seconds_by_country,

  -- Cálculos adicionales
  ROUND(sam.total_seconds_played::numeric / 60, 2) as total_minutes_played,
  ROUND(sam.total_seconds_played::numeric / 3600, 2) as total_hours_played,

  -- Estimación de regalías (ajustar tasa según contrato)
  -- Ejemplo: $0.004 por stream válido
  ROUND(sam.total_valid_streams::numeric * 0.004, 2) as estimated_royalty_usd

FROM stream_analytics_monthly sam
JOIN songs s ON sam.song_id = s.id
ORDER BY sam.year DESC, sam.month DESC, sam.total_seconds_played DESC;

-- View 3: Reporte Anual (suma de todos los meses del año)
CREATE OR REPLACE VIEW royalty_report_yearly AS
SELECT
  sam.year,
  s.id as song_id,
  s.title,
  s.performer,
  s.author,
  s.isrc,
  s.iswc,
  s.ipi,
  s.code,

  -- Totales del año
  SUM(sam.total_streams) as total_streams,
  SUM(sam.total_valid_streams) as total_valid_streams,
  SUM(sam.total_seconds_played) as total_seconds_played,

  -- Conversiones
  ROUND(SUM(sam.total_seconds_played)::numeric / 60, 2) as total_minutes_played,
  ROUND(SUM(sam.total_seconds_played)::numeric / 3600, 2) as total_hours_played,

  -- Estimación anual
  ROUND(SUM(sam.total_valid_streams)::numeric * 0.004, 2) as estimated_royalty_usd

FROM stream_analytics_monthly sam
JOIN songs s ON sam.song_id = s.id
GROUP BY sam.year, s.id, s.title, s.performer, s.author, s.isrc, s.iswc, s.ipi, s.code
ORDER BY sam.year DESC, total_seconds_played DESC;

-- View 4: Reporte por País (para distribución geográfica)
CREATE OR REPLACE VIEW royalty_report_by_country AS
SELECT
  s.id as song_id,
  s.title,
  s.performer,
  s.isrc,
  COALESCE(ph.country_code, 'UNKNOWN') as country,
  COUNT(*) as total_plays,
  SUM(ph.stream_duration) as total_seconds_played,
  ROUND(SUM(ph.stream_duration)::numeric / 60, 2) as total_minutes_played
FROM songs s
JOIN play_history ph ON s.id = ph.song_id
WHERE ph.valid_for_royalties = true
GROUP BY s.id, s.title, s.performer, s.isrc, country
ORDER BY s.title, total_seconds_played DESC;

-- View 5: Reporte por Cliente (para facturación)
CREATE OR REPLACE VIEW royalty_report_by_client AS
SELECT
  c.id as client_id,
  c.name as client_name,
  s.id as song_id,
  s.title,
  s.performer,
  s.isrc,
  COUNT(*) as total_plays,
  SUM(ph.stream_duration) as total_seconds_played,
  ROUND(SUM(ph.stream_duration)::numeric / 60, 2) as total_minutes_played,
  COUNT(DISTINCT ph.location_id) as locations_count
FROM clients c
JOIN play_history ph ON c.id = ph.client_id
JOIN songs s ON ph.song_id = s.id
WHERE ph.valid_for_royalties = true
GROUP BY c.id, c.name, s.id, s.title, s.performer, s.isrc
ORDER BY c.name, total_seconds_played DESC;

-- View 6: Reporte por Local (para ver performance de cada sucursal)
CREATE OR REPLACE VIEW royalty_report_by_location AS
SELECT
  c.name as client_name,
  l.id as location_id,
  l.name as location_name,
  l.city,
  s.id as song_id,
  s.title,
  s.performer,
  COUNT(*) as total_plays,
  SUM(ph.stream_duration) as total_seconds_played,
  ROUND(SUM(ph.stream_duration)::numeric / 60, 2) as total_minutes_played,
  COUNT(DISTINCT ph.user_id) as unique_users
FROM locations l
JOIN clients c ON l.client_id = c.id
JOIN play_history ph ON l.id = ph.location_id
JOIN songs s ON ph.song_id = s.id
WHERE ph.valid_for_royalties = true
GROUP BY c.name, l.id, l.name, l.city, s.id, s.title, s.performer
ORDER BY c.name, l.name, total_seconds_played DESC;

-- ================================================
-- FUNCIONES DE UTILIDAD PARA REPORTES
-- ================================================

-- Función: Obtener reporte mensual de una canción específica
CREATE OR REPLACE FUNCTION get_song_monthly_report(
  p_song_id UUID,
  p_year INT,
  p_month INT
)
RETURNS TABLE(
  song_title VARCHAR,
  performer VARCHAR,
  isrc VARCHAR,
  total_seconds_played BIGINT,
  total_minutes_played NUMERIC,
  total_hours_played NUMERIC,
  total_plays BIGINT,
  valid_plays BIGINT,
  unique_listeners BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.title,
    s.performer,
    s.isrc,
    SUM(ph.stream_duration)::BIGINT as total_seconds,
    ROUND(SUM(ph.stream_duration)::numeric / 60, 2) as total_minutes,
    ROUND(SUM(ph.stream_duration)::numeric / 3600, 2) as total_hours,
    COUNT(*)::BIGINT as total_plays,
    COUNT(*) FILTER (WHERE ph.valid_for_royalties = true)::BIGINT as valid_plays,
    COUNT(DISTINCT ph.user_id)::BIGINT as unique_listeners
  FROM songs s
  LEFT JOIN play_history ph ON s.id = ph.song_id
  WHERE s.id = p_song_id
  AND EXTRACT(YEAR FROM ph.played_at) = p_year
  AND EXTRACT(MONTH FROM ph.played_at) = p_month
  GROUP BY s.title, s.performer, s.isrc;
END;
$$ LANGUAGE plpgsql;

-- Función: Obtener top canciones por segundos reproducidos (ranking)
CREATE OR REPLACE FUNCTION get_top_songs_by_playback(
  p_limit INT DEFAULT 100,
  p_year INT DEFAULT NULL,
  p_month INT DEFAULT NULL
)
RETURNS TABLE(
  rank BIGINT,
  song_id UUID,
  title VARCHAR,
  performer VARCHAR,
  isrc VARCHAR,
  total_seconds_played BIGINT,
  total_plays BIGINT,
  unique_listeners BIGINT
) AS $$
BEGIN
  IF p_year IS NULL THEN
    -- Ranking de todos los tiempos
    RETURN QUERY
    SELECT
      ROW_NUMBER() OVER (ORDER BY SUM(ph.stream_duration) DESC) as rank,
      s.id,
      s.title,
      s.performer,
      s.isrc,
      SUM(ph.stream_duration)::BIGINT as total_seconds,
      COUNT(*)::BIGINT as total_plays,
      COUNT(DISTINCT ph.user_id)::BIGINT as unique_listeners
    FROM songs s
    LEFT JOIN play_history ph ON s.id = ph.song_id
    WHERE ph.valid_for_royalties = true
    GROUP BY s.id, s.title, s.performer, s.isrc
    ORDER BY total_seconds DESC
    LIMIT p_limit;
  ELSE
    -- Ranking de un periodo específico
    RETURN QUERY
    SELECT
      ROW_NUMBER() OVER (ORDER BY SUM(ph.stream_duration) DESC) as rank,
      s.id,
      s.title,
      s.performer,
      s.isrc,
      SUM(ph.stream_duration)::BIGINT as total_seconds,
      COUNT(*)::BIGINT as total_plays,
      COUNT(DISTINCT ph.user_id)::BIGINT as unique_listeners
    FROM songs s
    LEFT JOIN play_history ph ON s.id = ph.song_id
    WHERE ph.valid_for_royalties = true
    AND EXTRACT(YEAR FROM ph.played_at) = p_year
    AND (p_month IS NULL OR EXTRACT(MONTH FROM ph.played_at) = p_month)
    GROUP BY s.id, s.title, s.performer, s.isrc
    ORDER BY total_seconds DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- ÍNDICES PARA PERFORMANCE
-- ================================================

-- Clients & Locations
CREATE INDEX idx_locations_client ON locations(client_id);
CREATE INDEX idx_locations_active ON locations(is_active);
CREATE INDEX idx_user_profiles_location ON user_profiles(location_id);

-- Playback Sessions
CREATE INDEX idx_playback_sessions_client ON playback_sessions(client_id);
CREATE INDEX idx_playback_sessions_centralized ON playback_sessions(is_centralized) WHERE is_centralized = true;

-- Songs
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_performer ON songs(performer);
CREATE INDEX idx_songs_isrc ON songs(isrc);

-- Playlists
CREATE INDEX idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX idx_playlist_songs_song ON playlist_songs(song_id);

-- Playlist permissions
CREATE INDEX idx_playlist_permissions_user ON playlist_permissions(user_id);
CREATE INDEX idx_playlist_permissions_playlist ON playlist_permissions(playlist_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics_monthly ENABLE ROW LEVEL SECURITY;

-- Policies para Clients & Locations
CREATE POLICY "Admins can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can manage clients"
  ON clients FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Users can view their location"
  ON locations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT location_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all locations"
  ON locations FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can manage user profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Policies para Playback Sessions
CREATE POLICY "Users can view playback session of their client"
  ON playback_sessions FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT l.client_id
      FROM user_profiles up
      JOIN locations l ON up.location_id = l.id
      WHERE up.id = auth.uid()
    )
  );

CREATE POLICY "Managers can control playback session"
  ON playback_sessions FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT l.client_id
      FROM user_profiles up
      JOIN locations l ON up.location_id = l.id
      WHERE up.id = auth.uid()
      AND up.role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Admins can manage all playback sessions"
  ON playback_sessions FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Policies para contenido
CREATE POLICY "Public playlists viewable by everyone" ON playlists FOR SELECT USING (is_public = true);
CREATE POLICY "Songs viewable by everyone" ON songs FOR SELECT USING (true);
CREATE POLICY "Playlist songs viewable by everyone" ON playlist_songs FOR SELECT USING (true);

CREATE POLICY "Users can insert their own play history"
  ON play_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own play history"
  ON play_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all play history"
  ON play_history FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Only admins can view analytics"
  ON stream_analytics_monthly FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Only admins can manage songs"
  ON songs FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Only admins can manage playlists"
  ON playlists FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ================================================
-- TRIGGERS
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playback_sessions_updated_at
  BEFORE UPDATE ON playback_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at
  BEFORE UPDATE ON playlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-llenar client_id y location_id en play_history
CREATE OR REPLACE FUNCTION populate_play_history_location()
RETURNS TRIGGER AS $$
BEGIN
  -- Obtener location_id y client_id del usuario
  SELECT
    up.location_id,
    l.client_id
  INTO
    NEW.location_id,
    NEW.client_id
  FROM user_profiles up
  LEFT JOIN locations l ON up.location_id = l.id
  WHERE up.id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_populate_location
  BEFORE INSERT ON play_history
  FOR EACH ROW
  EXECUTE FUNCTION populate_play_history_location();

-- ================================================
-- DATOS DE EJEMPLO
-- ================================================

-- Crear cliente de ejemplo
INSERT INTO clients (name, contact_email, tax_id) VALUES
  ('Restaurante Don Pepe', 'admin@donpepe.com', '12345678-9');

-- Crear locales de ejemplo
INSERT INTO locations (client_id, name, address, city) VALUES
  ((SELECT id FROM clients WHERE name = 'Restaurante Don Pepe'), 'Don Pepe Zona 10', '10 Calle 3-15 Zona 10', 'Guatemala'),
  ((SELECT id FROM clients WHERE name = 'Restaurante Don Pepe'), 'Don Pepe Carretera', 'Km 15.5 Carretera El Salvador', 'Guatemala');

-- Crear sesión de playback para el cliente (modo independiente por defecto)
INSERT INTO playback_sessions (client_id, is_centralized) VALUES
  ((SELECT id FROM clients WHERE name = 'Restaurante Don Pepe'), false);

INSERT INTO playlists (name, description, is_public) VALUES
  ('Demo Playlist', 'Playlist de prueba', true);

-- ================================================
-- NOTAS DE USO
-- ================================================

/*
-- Para crear un admin:
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@ayau.com';

-- Para crear perfil de usuario y asignarlo a un local:
INSERT INTO user_profiles (id, location_id, full_name, role)
VALUES (
  'user-uuid-from-auth',
  (SELECT id FROM locations WHERE name = 'Don Pepe Zona 10'),
  'Juan Pérez',
  'staff'
);

-- Para agregar analytics mensuales (ejecutar el 1 de cada mes):
SELECT * FROM aggregate_monthly_analytics(2024, 1); -- Enero 2024

-- Para obtener reporte de una canción:
SELECT * FROM get_song_monthly_report('song-uuid-here', 2024, 1);

-- Para obtener top 100 canciones del mes:
SELECT * FROM get_top_songs_by_playback(100, 2024, 1);

-- Para obtener top 100 de todos los tiempos:
SELECT * FROM get_top_songs_by_playback(100);

-- CONTROL CENTRALIZADO DE REPRODUCCIÓN:

-- Para activar modo centralizado en un cliente:
UPDATE playback_sessions
SET is_centralized = true
WHERE client_id = 'uuid-del-cliente';

-- Para que el dashboard central cambie de canción (todos los locales la reproducirán):
UPDATE playback_sessions
SET
  current_song_id = 'uuid-de-cancion',
  current_playlist_id = 'uuid-de-playlist',
  playback_state = 'playing',
  playback_position = 0,
  controlled_by = auth.uid()
WHERE client_id = 'uuid-del-cliente';

-- En cada local, suscribirse a cambios (JavaScript):
/*
const clientId = 'uuid-del-cliente'

supabase
  .channel('playback-control')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'playback_sessions',
    filter: `client_id=eq.${clientId}`
  }, (payload) => {
    const session = payload.new

    if (session.is_centralized) {
      // Modo centralizado: reproducir lo que indica la sesión
      if (session.playback_state === 'playing') {
        playSong(session.current_song_id, session.playback_position)
      } else if (session.playback_state === 'paused') {
        pauseSong()
      }
    } else {
      // Modo independiente: cada local controla su propia reproducción
      // No hacer nada
    }
  })
  .subscribe()
*/

-- Ver reporte mensual completo:
SELECT * FROM royalty_report_monthly WHERE year = 2024 AND month = 1;

-- Ver reporte anual:
SELECT * FROM royalty_report_yearly WHERE year = 2024;

-- Ver reportes por país:
SELECT * FROM royalty_report_by_country;
*/
