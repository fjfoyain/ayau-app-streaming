-- ================================================
-- AGREGAR EMAIL A USER_PROFILES
-- ================================================

-- Opción 1: Agregar columna email a user_profiles y sincronizarla
-- Esto es más simple y evita problemas de JOIN

-- Paso 1: Agregar columna email si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- Paso 2: Copiar emails de auth.users a user_profiles
UPDATE user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id
  AND up.email IS NULL;

-- Paso 3: Crear función para mantener email sincronizado
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Actualizar email en user_profiles cuando cambie en auth.users
  UPDATE user_profiles
  SET email = NEW.email
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Paso 4: Crear trigger para sincronizar email automáticamente
DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_user_email();

-- Paso 5: Actualizar el trigger de creación de usuario para incluir email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role, is_active, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    true,
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Verificar
SELECT 'Verificación:' as info;
SELECT id, full_name, email, role FROM user_profiles ORDER BY created_at DESC LIMIT 5;
