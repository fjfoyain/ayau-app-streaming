-- ================================================
-- Password Reset Feature
-- ================================================
-- Sistema para permitir a usuarios restablecer su contraseña

-- ================================================
-- TABLE: password_reset_tokens
-- ================================================
-- Almacena tokens temporales para reset de contraseña

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(256) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índice para búsqueda rápida de tokens válidos
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Comentario
COMMENT ON TABLE password_reset_tokens IS 'Almacena tokens temporales para reset de contraseña. Tokens expiran en 24 horas.';

-- ================================================
-- FUNCTION: generate_reset_token()
-- ================================================
-- Genera un token aleatorio para reset de contraseña
-- Retorna: token de 32 caracteres

CREATE OR REPLACE FUNCTION public.generate_reset_token()
RETURNS VARCHAR(256)
LANGUAGE plpgsql
AS $$
DECLARE
  token VARCHAR(256);
BEGIN
  -- Generar token de 32 caracteres aleatorios
  token := encode(gen_random_bytes(24), 'hex');
  RETURN token;
END;
$$;

-- ================================================
-- FUNCTION: request_password_reset(email)
-- ================================================
-- Crea un token de reset para un usuario dado su email
-- Válido por 24 horas
-- Retorna: token si existe el usuario, null si no existe

CREATE OR REPLACE FUNCTION public.request_password_reset(user_email VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_token VARCHAR(256);
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Buscar usuario por email (con email confirmado)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = user_email
  AND email_confirmed_at IS NOT NULL;

  -- Si no existe el usuario, retornar error (silencioso por seguridad)
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Si el correo existe en el sistema, recibirá un enlace para restablecer la contraseña'
    );
  END IF;

  -- Generar token
  v_token := public.generate_reset_token();
  v_expires_at := NOW() + INTERVAL '24 hours';

  -- Guardar token en la base de datos
  INSERT INTO password_reset_tokens (user_id, token, expires_at)
  VALUES (v_user_id, v_token, v_expires_at);

  -- Retornar token para enviar por email
  RETURN json_build_object(
    'success', true,
    'token', v_token,
    'expires_at', v_expires_at,
    'user_id', v_user_id
  );
END;
$$;

-- ================================================
-- FUNCTION: validate_reset_token(token)
-- ================================================
-- Valida que un token sea válido y no haya expirado
-- Retorna: user_id si es válido, null si no

CREATE OR REPLACE FUNCTION public.validate_reset_token(reset_token VARCHAR)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Buscar token válido (no expirado y no usado)
  SELECT user_id INTO v_user_id
  FROM password_reset_tokens
  WHERE token = reset_token
  AND expires_at > NOW()
  AND used_at IS NULL
  LIMIT 1;

  RETURN v_user_id;
END;
$$;

-- ================================================
-- FUNCTION: complete_password_reset(token, new_password)
-- ================================================
-- Completa el reset de contraseña
-- Actualiza la contraseña y marca el token como usado

CREATE OR REPLACE FUNCTION public.complete_password_reset(reset_token VARCHAR, new_password VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Validar token
  v_user_id := public.validate_reset_token(reset_token);

  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Token inválido o expirado'
    );
  END IF;

  -- Actualizar contraseña en auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = v_user_id;

  -- Marcar token como usado
  UPDATE password_reset_tokens
  SET used_at = NOW()
  WHERE token = reset_token;

  RETURN json_build_object(
    'success', true,
    'message', 'Contraseña restablecida exitosamente'
  );
END;
$$;

-- ================================================
-- FUNCTION: cleanup_expired_reset_tokens()
-- ================================================
-- Limpia tokens expirados (para ejecutar periódicamente)

CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'deleted_tokens', v_deleted_count
  );
END;
$$;

-- ================================================
-- RLS POLICIES: password_reset_tokens
-- ================================================

-- Habilitar RLS
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden crear tokens para ellos mismos (via función)
-- La función se ejecuta con SECURITY DEFINER, así que RLS se aplica a nivel de función

-- Política: Nadie puede ver los tokens (por seguridad)
CREATE POLICY "No direct access to reset tokens"
ON password_reset_tokens
FOR ALL
USING (false);

-- ================================================
-- VERIFICATION
-- ================================================

SELECT '=== PASSWORD RESET SETUP COMPLETE ===' as status;

-- Verificar tablas
SELECT 
  t.table_name,
  CASE WHEN t.table_name = 'password_reset_tokens' THEN '✓' ELSE '' END as created
FROM information_schema.tables t
WHERE table_name IN ('password_reset_tokens')
AND table_schema = 'public';

-- Verificar funciones
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'generate_reset_token',
  'request_password_reset',
  'validate_reset_token',
  'complete_password_reset',
  'cleanup_expired_reset_tokens'
)
AND routine_schema = 'public'
ORDER BY routine_name;
