-- ================================================
-- EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- ================================================
-- Este script agrega las columnas faltantes a user_profiles
-- para las funcionalidades de:
-- 1. Exclusion de analytics/regalias
-- 2. Verificacion manual de email
-- 3. Estado activo/inactivo de usuario
-- ================================================

-- ============================================
-- 1. COLUMNAS PARA EXCLUSION DE ANALYTICS
-- ============================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS exclude_from_analytics BOOLEAN DEFAULT false;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS exclude_reason VARCHAR(255);

-- ============================================
-- 2. COLUMNAS PARA VERIFICACION MANUAL DE EMAIL
-- ============================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email_verified_manually BOOLEAN DEFAULT false;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email_verified_manually_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email_verified_manually_by UUID REFERENCES user_profiles(id);

-- ============================================
-- 3. COLUMNA PARA ESTADO ACTIVO/INACTIVO
-- ============================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================
-- 4. COLUMNA PARA CAMBIO DE PASSWORD
-- ============================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- ============================================
-- VERIFICACION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE ' COLUMNAS AGREGADAS A user_profiles';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Exclusion de Analytics:';
  RAISE NOTICE '  - exclude_from_analytics (BOOLEAN)';
  RAISE NOTICE '  - exclude_reason (VARCHAR)';
  RAISE NOTICE '';
  RAISE NOTICE 'Verificacion Manual de Email:';
  RAISE NOTICE '  - email_verified_manually (BOOLEAN)';
  RAISE NOTICE '  - email_verified_manually_at (TIMESTAMPTZ)';
  RAISE NOTICE '  - email_verified_manually_by (UUID)';
  RAISE NOTICE '';
  RAISE NOTICE 'Estado de Usuario:';
  RAISE NOTICE '  - is_active (BOOLEAN)';
  RAISE NOTICE '';
  RAISE NOTICE 'Password:';
  RAISE NOTICE '  - password_changed_at (TIMESTAMPTZ)';
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE ' SCRIPT COMPLETADO EXITOSAMENTE';
  RAISE NOTICE '================================================';
END $$;

-- ============================================
-- QUERY DE VERIFICACION
-- ============================================
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN (
    'exclude_from_analytics',
    'exclude_reason',
    'email_verified_manually',
    'email_verified_manually_at',
    'email_verified_manually_by',
    'is_active',
    'password_changed_at'
  )
ORDER BY column_name;
