-- ================================================
-- FIX: User Deletion
-- ================================================
-- Mejorar la eliminación de usuarios
-- ================================================

-- ================================================
-- FUNCIÓN PARA ELIMINAR USUARIO (SOFT DELETE)
-- ================================================

-- Drop existing function if it exists with different return type
DROP FUNCTION IF EXISTS public.delete_user_profile(UUID);

CREATE OR REPLACE FUNCTION public.delete_user_profile(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Check if current user is admin
  SELECT role = 'admin' AND is_active = true
  INTO v_is_admin
  FROM user_profiles
  WHERE id = v_current_user_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Solo los administradores pueden eliminar usuarios';
  END IF;

  -- Cannot delete self
  IF p_user_id = v_current_user_id THEN
    RAISE EXCEPTION 'No puedes eliminar tu propia cuenta';
  END IF;

  -- Clear foreign key references
  -- 1. Clear owner_id in clients
  UPDATE clients
  SET owner_id = NULL, updated_at = NOW()
  WHERE owner_id = p_user_id;

  -- 2. Clear manager_id in locations
  UPDATE locations
  SET manager_id = NULL, updated_at = NOW()
  WHERE manager_id = p_user_id;

  -- 3. Clear controller in playback_sessions
  UPDATE playback_sessions
  SET controlled_by = NULL
  WHERE controlled_by = p_user_id;

  -- 4. Soft delete: Mark user as inactive
  UPDATE user_profiles
  SET 
    is_active = false,
    updated_at = NOW(),
    email = email || '.deleted.' || p_user_id::text  -- Prevent email conflicts
  WHERE id = p_user_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'deleted_at', NOW(),
    'message', 'Usuario eliminado exitosamente'
  );

  RETURN v_result;
END;
$$;

-- ================================================
-- GRANTS
-- ================================================

GRANT EXECUTE ON FUNCTION delete_user_profile(UUID) TO authenticated;

-- ================================================
-- VERIFICACIÓN
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '=== User Deletion Function Created ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Función creada:';
  RAISE NOTICE '  - delete_user_profile(user_id UUID)';
  RAISE NOTICE '';
  RAISE NOTICE 'Características:';
  RAISE NOTICE '  - Soft delete (marca is_active = false)';
  RAISE NOTICE '  - Limpia referencias FK automáticamente';
  RAISE NOTICE '  - Previene auto-eliminación';
  RAISE NOTICE '  - Solo admins pueden eliminar';
  RAISE NOTICE '  - Modifica email para prevenir conflictos';
  RAISE NOTICE '';
  RAISE NOTICE 'Uso desde el cliente:';
  RAISE NOTICE '  await supabase.rpc("delete_user_profile", { p_user_id: userId })';
END $$;
