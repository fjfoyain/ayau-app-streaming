-- ================================================
-- Mejora 1: Obligar Cambio de Contraseña en Primer Login
-- + Mejora 4: Excluir Usuarios de Analytics/Regalías
-- ================================================

-- Agregar columnas a user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS exclude_from_analytics BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS exclude_reason VARCHAR(255);

-- ================================================
-- FUNCIÓN: Verificar si usuario debe cambiar contraseña
-- ================================================

CREATE OR REPLACE FUNCTION public.user_needs_password_change()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT password_changed_at IS NULL OR password_changed_at = created_at
    FROM user_profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCIÓN: Marcar contraseña como actualizada
-- ================================================

CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_profiles
  SET password_changed_at = NOW()
  WHERE id = auth.uid();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCIÓN: Toggle exclude_from_analytics (solo admin)
-- ================================================

CREATE OR REPLACE FUNCTION public.toggle_user_analytics_exclusion(
  p_user_id UUID,
  p_exclude BOOLEAN,
  p_reason VARCHAR DEFAULT NULL
)
RETURNS TABLE (user_id UUID, exclude_from_analytics BOOLEAN, exclude_reason VARCHAR) AS $$
BEGIN
  -- Verificar que el usuario ejecutando es admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can exclude users from analytics';
  END IF;
  
  UPDATE user_profiles
  SET 
    exclude_from_analytics = p_exclude,
    exclude_reason = p_reason
  WHERE id = p_user_id;
  
  RETURN QUERY
  SELECT 
    up.id,
    up.exclude_from_analytics,
    up.exclude_reason
  FROM user_profiles up
  WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- VISTA: Analytics sin usuarios excluidos
-- ================================================

CREATE OR REPLACE VIEW public.analytics_valid_plays AS
SELECT 
  ph.id,
  ph.user_id,
  ph.song_id,
  ph.playlist_id,
  ph.location_id,
  ph.client_id,
  ph.stream_duration,
  ph.completed,
  ph.played_at,
  ph.country_code,
  up.full_name as user_name,
  s.title as song_title,
  s.performer,
  s.duration,
  c.name as client_name,
  l.name as location_name
FROM play_history ph
JOIN user_profiles up ON ph.user_id = up.id
LEFT JOIN songs s ON ph.song_id = s.id
LEFT JOIN clients c ON ph.client_id = c.id
LEFT JOIN locations l ON ph.location_id = l.id
WHERE 
  up.exclude_from_analytics = false
  AND ph.completed = true
  AND ph.stream_duration >= 30;  -- Mínimo 30 segundos

-- ================================================
-- VISTA: Usuarios excluidos (para auditoría)
-- ================================================

CREATE OR REPLACE VIEW public.excluded_analytics_users AS
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.role,
  up.exclude_from_analytics,
  up.exclude_reason,
  up.created_at,
  (SELECT COUNT(*) FROM play_history WHERE user_id = up.id) as total_plays
FROM user_profiles up
WHERE up.exclude_from_analytics = true
ORDER BY up.created_at DESC;

-- ================================================
-- ÍNDICES para performance
-- ================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_exclude_analytics 
  ON user_profiles(exclude_from_analytics);

CREATE INDEX IF NOT EXISTS idx_user_profiles_password_changed_at 
  ON user_profiles(password_changed_at);

-- ================================================
-- RLS: Actualizar políticas para analytics_valid_plays
-- ================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS para excluir usuarios
CREATE POLICY "allow_admin_exclude_from_analytics" ON user_profiles
  FOR UPDATE USING (
    public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
  );

-- ================================================
-- VERIFICACIÓN
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Columnas agregadas a user_profiles:';
  RAISE NOTICE '  - password_changed_at (timestamp)';
  RAISE NOTICE '  - exclude_from_analytics (boolean)';
  RAISE NOTICE '  - exclude_reason (varchar)';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Funciones creadas:';
  RAISE NOTICE '  - user_needs_password_change()';
  RAISE NOTICE '  - mark_password_changed()';
  RAISE NOTICE '  - toggle_user_analytics_exclusion()';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Vistas creadas:';
  RAISE NOTICE '  - analytics_valid_plays (solo usuarios activos)';
  RAISE NOTICE '  - excluded_analytics_users (auditoría)';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Índices creados para performance';
END $$;

-- ================================================
-- TESTING QUERIES
-- ================================================

-- Ver usuarios y su estado de cambio de contraseña
SELECT 
  email,
  full_name,
  role,
  password_changed_at,
  CASE 
    WHEN password_changed_at IS NULL THEN '⚠️ Debe cambiar contraseña'
    ELSE '✓ Contraseña actualizada'
  END as password_status,
  exclude_from_analytics,
  exclude_reason
FROM user_profiles
ORDER BY email;

-- Ver usuarios excluidos de analytics
SELECT * FROM excluded_analytics_users;

-- Ver analytics válidos
SELECT 
  DATE(played_at) as fecha,
  COUNT(*) as reproducciones,
  SUM(stream_duration) as segundos_totales,
  COUNT(DISTINCT user_id) as usuarios_unicos,
  COUNT(DISTINCT song_id) as canciones_unicas
FROM analytics_valid_plays
GROUP BY DATE(played_at)
ORDER BY fecha DESC;
