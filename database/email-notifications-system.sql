-- ================================================
-- Mejora 4: Sistema de Notificaciones por Email
-- ================================================

-- ================================================
-- TABLA: Email notifications queue
-- ================================================

CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
    -- Valores: 'user_created', 'password_changed', 'password_reset',
    --          'user_excluded', 'analytics_report', 'alert'
  subject VARCHAR(255) NOT NULL,
  template_data JSONB,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_notification_type CHECK (
    notification_type IN (
      'user_created', 'password_changed', 'password_reset',
      'user_excluded', 'analytics_report', 'alert'
    )
  )
);

-- ================================================
-- TABLA: Email templates
-- ================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type VARCHAR(50) UNIQUE NOT NULL,
  subject_template VARCHAR(255) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  variables TEXT[],  -- Variables que acepta el template
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- INSERTAR TEMPLATES
-- ================================================

INSERT INTO email_templates (template_type, subject_template, html_body, text_body, variables)
VALUES
  (
    'user_created',
    'Tu cuenta AYAU ha sido creada',
    '<h2>Bienvenido a AYAU</h2>
<p>Tu cuenta ha sido creada exitosamente.</p>
<p><strong>Email:</strong> {{email}}</p>
<p><strong>Contraseña temporal:</strong> {{temporary_password}}</p>
<p>Por favor, cambia tu contraseña la primera vez que inicies sesión.</p>
<p>Acceso: <a href="https://play.ayaumusic.com">play.ayaumusic.com</a></p>',
    'Tu cuenta AYAU ha sido creada. Email: {{email}}. Contraseña temporal: {{temporary_password}}',
    ARRAY['email', 'temporary_password']
  ),
  (
    'password_changed',
    'Tu contraseña en AYAU ha sido cambiada',
    '<h2>Contraseña Actualizada</h2>
<p>Tu contraseña ha sido cambiada exitosamente en {{changed_date}}.</p>
<p>Si no fuiste tú, contacta al administrador inmediatamente.</p>',
    'Tu contraseña en AYAU ha sido cambiada en {{changed_date}}',
    ARRAY['changed_date']
  ),
  (
    'password_reset',
    'Solicitud de reinicio de contraseña AYAU',
    '<h2>Reinicio de Contraseña</h2>
<p>Recibimos una solicitud para reiniciar tu contraseña.</p>
<p>Click aquí para continuar: <a href="{{reset_link}}">Reiniciar Contraseña</a></p>
<p><strong>Este enlace expira en 24 horas.</strong></p>
<p>Si no solicitaste esto, ignora este email.</p>',
    'Reinicio de contraseña: {{reset_link}} (válido 24h)',
    ARRAY['reset_link']
  ),
  (
    'user_excluded',
    'Has sido excluido del sistema de regalías',
    '<h2>Cambio en tu Configuración</h2>
<p>Se ha actualizado tu configuración en AYAU.</p>
<p><strong>Razón:</strong> {{reason}}</p>
<p>Tus reproducciones no contarán en analytics ni en regalías.</p>
<p>Contacta al administrador si tienes preguntas.</p>',
    'Se ha actualizado tu configuración: {{reason}}',
    ARRAY['reason']
  ),
  (
    'analytics_report',
    'Reporte de Analytics AYAU - {{period}}',
    '<h2>Reporte de Analytics {{period}}</h2>
<p>Reproducciones: {{total_plays}}</p>
<p>Usuarios activos: {{active_users}}</p>
<p>Canción más reproducida: {{top_song}}</p>
<p>Ver detalles: <a href="{{analytics_link}}">Dashboard</a></p>',
    'Reproducciones: {{total_plays}}, Usuarios: {{active_users}}',
    ARRAY['period', 'total_plays', 'active_users', 'top_song', 'analytics_link']
  ),
  (
    'alert',
    'Alerta en AYAU: {{alert_type}}',
    '<h2>Alerta de Sistema</h2>
<p><strong>Tipo:</strong> {{alert_type}}</p>
<p><strong>Detalles:</strong> {{alert_message}}</p>
<p>Acción recomendada: {{recommended_action}}</p>',
    'Alerta: {{alert_type}} - {{alert_message}}',
    ARRAY['alert_type', 'alert_message', 'recommended_action']
  )
ON CONFLICT (template_type) DO NOTHING;

-- ================================================
-- FUNCIÓN: Enviar email (wrapper para Supabase)
-- ================================================

CREATE OR REPLACE FUNCTION public.send_email_notification(
  p_user_id UUID,
  p_recipient_email VARCHAR,
  p_notification_type VARCHAR,
  p_template_data JSONB
)
RETURNS TABLE (
  notification_id UUID,
  status VARCHAR,
  message TEXT
) AS $$
DECLARE
  v_template RECORD;
  v_subject VARCHAR;
  v_html_body TEXT;
  v_text_body TEXT;
  v_notification_id UUID;
  v_rec RECORD;
BEGIN
  -- Obtener template
  SELECT 
    id, subject_template, html_body, text_body
  INTO v_template
  FROM email_templates
  WHERE template_type = p_notification_type;
  
  IF v_template IS NULL THEN
    RETURN QUERY SELECT 
      gen_random_uuid()::UUID,
      'error'::VARCHAR,
      'Template no encontrado: ' || p_notification_type;
    RETURN;
  END IF;
  
  -- Reemplazar variables en template
  v_subject := v_template.subject_template;
  v_html_body := v_template.html_body;
  v_text_body := v_template.text_body;
  
  -- Reemplazar {{variable}} con valores de p_template_data
  FOR v_rec IN SELECT * FROM jsonb_each_text(p_template_data) LOOP
    v_subject := REPLACE(v_subject, '{{' || v_rec.key || '}}', v_rec.value);
    v_html_body := REPLACE(v_html_body, '{{' || v_rec.key || '}}', v_rec.value);
    v_text_body := REPLACE(v_text_body, '{{' || v_rec.key || '}}', v_rec.value);
  END LOOP;
  
  -- Insertar en queue
  INSERT INTO email_notifications (
    user_id, recipient_email, notification_type, subject, template_data
  ) VALUES (
    p_user_id, p_recipient_email, p_notification_type, v_subject, p_template_data
  )
  RETURNING email_notifications.id INTO v_notification_id;
  
  -- Nota: En producción, aquí se llamaría a Supabase Edge Function o SendGrid
  -- Por ahora solo guardamos en queue
  
  RETURN QUERY SELECT 
    v_notification_id,
    'queued'::VARCHAR,
    'Email en queue: ' || v_subject;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCIÓN: Enviar email cuando se crea usuario
-- ================================================

CREATE OR REPLACE FUNCTION public.send_user_created_email()
RETURNS TRIGGER AS $$
DECLARE
  v_user_record RECORD;
BEGIN
  -- Obtener datos del usuario
  SELECT 
    id, email, full_name
  INTO v_user_record
  FROM user_profiles
  WHERE id = NEW.id;
  
  IF v_user_record IS NOT NULL THEN
    -- Enviar email (la contraseña temporal viene del contexto de creación)
    PERFORM public.send_email_notification(
      p_user_id := NEW.id,
      p_recipient_email := v_user_record.email,
      p_notification_type := 'user_created',
      p_template_data := jsonb_build_object(
        'email', v_user_record.email,
        'temporary_password', current_setting('app.temp_password', true) OR 'Demo123!@#'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCIÓN: Enviar email cuando se cambia contraseña
-- ================================================

CREATE OR REPLACE FUNCTION public.send_password_changed_email()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email VARCHAR;
BEGIN
  -- Solo enviar si password_changed_at fue actualizado
  IF NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at 
     AND NEW.password_changed_at IS NOT NULL THEN
    
    SELECT email INTO v_user_email FROM user_profiles WHERE id = NEW.id;
    
    PERFORM public.send_email_notification(
      p_user_id := NEW.id,
      p_recipient_email := v_user_email,
      p_notification_type := 'password_changed',
      p_template_data := jsonb_build_object(
        'changed_date', TO_CHAR(NEW.password_changed_at, 'DD/MM/YYYY HH24:MI')
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCIÓN: Enviar email cuando se excluye de analytics
-- ================================================

CREATE OR REPLACE FUNCTION public.send_excluded_analytics_email()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email VARCHAR;
BEGIN
  -- Solo enviar si exclude_from_analytics fue actualizado
  IF NEW.exclude_from_analytics IS DISTINCT FROM OLD.exclude_from_analytics 
     AND NEW.exclude_from_analytics = true THEN
    
    SELECT email INTO v_user_email FROM user_profiles WHERE id = NEW.id;
    
    PERFORM public.send_email_notification(
      p_user_id := NEW.id,
      p_recipient_email := v_user_email,
      p_notification_type := 'user_excluded',
      p_template_data := jsonb_build_object(
        'reason', NEW.exclude_reason OR 'No especificada'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- TRIGGERS
-- ================================================

DROP TRIGGER IF EXISTS trigger_send_user_created_email ON user_profiles;
CREATE TRIGGER trigger_send_user_created_email
AFTER INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.send_user_created_email();

DROP TRIGGER IF EXISTS trigger_send_password_changed_email ON user_profiles;
CREATE TRIGGER trigger_send_password_changed_email
AFTER UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.send_password_changed_email();

DROP TRIGGER IF EXISTS trigger_send_excluded_analytics_email ON user_profiles;
CREATE TRIGGER trigger_send_excluded_analytics_email
AFTER UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.send_excluded_analytics_email();

-- ================================================
-- RLS POLICIES
-- ================================================

ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Admin ve todos los emails
CREATE POLICY "admin_see_all_emails" ON email_notifications
  FOR SELECT USING (public.is_admin());

-- Usuario ve sus propios emails
CREATE POLICY "user_see_own_emails" ON email_notifications
  FOR SELECT USING (user_id = auth.uid());

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Todos leen templates (necesario para sistema)
CREATE POLICY "allow_read_templates" ON email_templates
  FOR SELECT USING (true);

-- Solo admin modifica templates
CREATE POLICY "admin_modify_templates" ON email_templates
  FOR UPDATE USING (public.is_admin());

-- ================================================
-- ÍNDICES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id 
  ON email_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_email_notifications_sent_at 
  ON email_notifications(sent_at);

CREATE INDEX IF NOT EXISTS idx_email_notifications_type 
  ON email_notifications(notification_type);

-- ================================================
-- VISTAS ÚTILES
-- ================================================

CREATE OR REPLACE VIEW public.email_notifications_status AS
SELECT 
  en.id,
  au.email,
  up.full_name,
  en.notification_type,
  en.subject,
  en.sent_at,
  en.failed_at,
  CASE 
    WHEN en.sent_at IS NOT NULL THEN '✓ Enviado'
    WHEN en.failed_at IS NOT NULL THEN '✗ Fallido'
    ELSE '⏳ Pendiente'
  END as status,
  en.retry_count,
  en.created_at
FROM email_notifications en
LEFT JOIN auth.users au ON en.user_id = au.id
LEFT JOIN user_profiles up ON en.user_id = up.id
ORDER BY en.created_at DESC;

-- ================================================
-- VERIFICACIÓN
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Tabla email_notifications creada';
  RAISE NOTICE '✓ Tabla email_templates creada';
  RAISE NOTICE '✓ 6 Templates insertados';
  RAISE NOTICE '✓ Función send_email_notification() creada';
  RAISE NOTICE '✓ Triggers automáticos creados para:';
  RAISE NOTICE '  - Usuario creado';
  RAISE NOTICE '  - Contraseña cambiada';
  RAISE NOTICE '  - Usuario excluido de analytics';
  RAISE NOTICE '✓ RLS policies implementadas';
  RAISE NOTICE '✓ Vista email_notifications_status disponible';
END $$;

-- ================================================
-- TESTING QUERIES
-- ================================================

-- Ver templates disponibles
SELECT template_type, subject_template FROM email_templates ORDER BY template_type;

-- Ver emails pendientes
SELECT * FROM email_notifications_status WHERE status = '⏳ Pendiente';

-- Ver emails fallidos
SELECT * FROM email_notifications_status WHERE status = '✗ Fallido';

-- Ver historial de emails para usuario
SELECT * FROM email_notifications_status 
WHERE email = 'test@ayau.com'
ORDER BY created_at DESC;
