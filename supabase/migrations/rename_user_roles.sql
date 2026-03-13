-- Migración: Renombrar roles 'user' → 'account_user' y 'client_user' → 'local_user'
-- Ejecutar en Supabase SQL Editor

-- 1. Renombrar roles en user_profiles
UPDATE user_profiles SET role = 'account_user' WHERE role = 'user';
UPDATE user_profiles SET role = 'local_user'   WHERE role = 'client_user';

-- 2. Asegurarse de que los local_user tengan client_id poblado desde su location
UPDATE user_profiles up
SET client_id = l.client_id
FROM locations l
WHERE up.role = 'local_user'
  AND up.location_id = l.id
  AND (up.client_id IS NULL OR up.client_id != l.client_id);

-- 3. Si existe un check constraint en la columna role, actualizarlo
-- (Ejecutar solo si hay un constraint; si no existe, ignorar este bloque)
-- ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
-- ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
--   CHECK (role IN ('admin', 'manager', 'account_user', 'local_user'));
