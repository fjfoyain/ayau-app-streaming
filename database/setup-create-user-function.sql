-- ================================================
-- FUNCIÓN PARA CREAR USUARIOS (desde el admin panel)
-- ================================================

-- Esta función permite a los admins crear usuarios con email y password
-- NOTA: Para usar esto, necesitas habilitar la extensión pg_net o usar Edge Functions
-- Alternativa más simple: Usar invitaciones por email

-- Opción 1: Función simple que solo crea el perfil (el usuario debe registrarse primero)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_role TEXT DEFAULT 'user'
)
RETURNS user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile user_profiles;
BEGIN
  -- Verificar que quien ejecuta es admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden crear perfiles de usuario';
  END IF;

  -- Insertar perfil
  INSERT INTO user_profiles (id, full_name, role, is_active)
  VALUES (p_user_id, p_full_name, p_role, true)
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

-- Opción 2: Trigger que crea automáticamente el perfil cuando se registra un usuario
-- Este trigger se activa cuando un nuevo usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    true
  );
  RETURN NEW;
END;
$$;

-- Crear trigger (si no existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
