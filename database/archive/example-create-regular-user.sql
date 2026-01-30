-- ================================================
-- EJEMPLO: Crear usuario regular y asignar playlists
-- ================================================
-- Este script muestra cómo crear usuarios no-admin y darles acceso a playlists específicas

-- PASO 1: El usuario debe registrarse primero en la app
-- (o crear el usuario en Supabase Auth Dashboard)

-- PASO 2: Crear el perfil del usuario en user_profiles
INSERT INTO user_profiles (id, full_name, role, is_active, location_id)
SELECT
  id,
  'Juan Pérez',           -- Nombre del usuario
  'user',                 -- Roles: 'user', 'manager', 'client_user'
  true,                   -- Activo
  NULL                    -- location_id si aplica
FROM auth.users
WHERE email = 'juan@example.com'  -- Email del usuario
ON CONFLICT (id) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- PASO 3: Asignar permisos a playlists específicas
-- Ejemplo: Darle acceso de "view" a la playlist "Rock Classics"
INSERT INTO playlist_permissions (user_id, playlist_id, permission_level)
SELECT
  au.id,
  p.id,
  'view'  -- Niveles: 'view', 'edit', 'admin'
FROM auth.users au
CROSS JOIN playlists p
WHERE au.email = 'juan@example.com'
  AND p.name = 'Rock Classics'
ON CONFLICT (user_id, playlist_id) DO UPDATE
SET permission_level = EXCLUDED.permission_level;

-- PASO 4 (Opcional): Darle acceso a múltiples playlists
INSERT INTO playlist_permissions (user_id, playlist_id, permission_level)
SELECT
  au.id,
  p.id,
  'view'
FROM auth.users au
CROSS JOIN playlists p
WHERE au.email = 'juan@example.com'
  AND p.name IN ('Rock Classics', 'Pop Hits', 'Jazz Lounge')
ON CONFLICT (user_id, playlist_id) DO UPDATE
SET permission_level = EXCLUDED.permission_level;

-- VERIFICACIÓN: Ver qué playlists puede ver el usuario
SELECT
  au.email,
  p.name as playlist_name,
  pp.permission_level,
  p.is_public
FROM auth.users au
JOIN playlist_permissions pp ON pp.user_id = au.id
JOIN playlists p ON p.id = pp.playlist_id
WHERE au.email = 'juan@example.com'
ORDER BY p.name;

-- ================================================
-- DIFERENCIA ENTRE ROLES
-- ================================================
-- 'admin':       Ve TODAS las playlists, puede crear/editar todo
-- 'manager':     Ve playlists de su cliente/ubicación, gestiona sesiones
-- 'user':        Solo ve playlists asignadas explícitamente
-- 'client_user': Usuario de un cliente específico (ubicación)
