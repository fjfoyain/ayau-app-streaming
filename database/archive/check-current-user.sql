-- Verificar el usuario actual y su rol
SELECT
  au.id,
  au.email,
  up.full_name,
  up.role,
  up.is_active,
  CASE
    WHEN up.role = 'admin' AND up.is_active = true THEN '✅ ES ADMIN'
    ELSE '❌ NO ES ADMIN O NO ACTIVO'
  END as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE au.email = 'test@ayau.com';
