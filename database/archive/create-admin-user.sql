-- ================================================
-- CREAR USUARIO ADMINISTRADOR INICIAL
-- ================================================
-- Este script crea un perfil de admin para el usuario de prueba

-- Crear perfil de admin para el usuario test@ayau.com
INSERT INTO user_profiles (id, full_name, role, is_active)
SELECT
  id,
  'Admin AYAU',
  'admin',
  true
FROM auth.users
WHERE email = 'test@ayau.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', is_active = true;

-- Verificar que se creó correctamente
SELECT
  u.email,
  up.full_name,
  up.role,
  up.is_active
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
WHERE u.email = 'test@ayau.com';
