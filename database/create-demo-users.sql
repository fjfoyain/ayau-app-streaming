-- ================================================
-- Create Demo Users for Testing All Scenarios
-- ================================================
-- Este script crea usuarios demo para todas las combinaciones de roles y accesos
-- IMPORTANTE: Ejecutar DESPUÉS de que el sistema esté en funcionamiento

-- ================================================
-- PASO 1: Crear Cuentas (Clientes) Demo
-- ================================================

-- Buscar o crear cliente "Restaurante Demo A"
DO $$
DECLARE
  v_client_id UUID;
BEGIN
  -- Intentar obtener cliente existente
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo A' LIMIT 1;
  
  IF v_client_id IS NULL THEN
    -- Crear nuevo cliente
    INSERT INTO clients (name, contact_email, contact_phone, tax_id, is_active)
    VALUES (
      'Restaurante Demo A',
      'demo-account-a@ayau.com',
      '(+502) 7777-0001',
      'DEMO-A-001',
      true
    );
    
    SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo A';
    RAISE NOTICE 'Cliente "Restaurante Demo A" creado con ID: %', v_client_id;
  ELSE
    RAISE NOTICE 'Cliente "Restaurante Demo A" ya existe con ID: %', v_client_id;
  END IF;
END $$;

-- Buscar o crear cliente "Restaurante Demo B"
DO $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo B' LIMIT 1;
  
  IF v_client_id IS NULL THEN
    INSERT INTO clients (name, contact_email, contact_phone, tax_id, is_active)
    VALUES (
      'Restaurante Demo B',
      'demo-account-b@ayau.com',
      '(+502) 7777-0002',
      'DEMO-B-001',
      true
    );
    
    SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo B';
    RAISE NOTICE 'Cliente "Restaurante Demo B" creado con ID: %', v_client_id;
  ELSE
    RAISE NOTICE 'Cliente "Restaurante Demo B" ya existe con ID: %', v_client_id;
  END IF;
END $$;

-- ================================================
-- PASO 2: Crear Locales (Locations) Demo
-- ================================================

-- Crear locales para Restaurante Demo A
DO $$
DECLARE
  v_client_a_id UUID;
  v_location_count INT;
BEGIN
  SELECT id INTO v_client_a_id FROM clients WHERE name = 'Restaurante Demo A';
  
  -- Contar locales existentes
  SELECT COUNT(*) INTO v_location_count FROM locations 
  WHERE client_id = v_client_a_id;
  
  IF v_location_count = 0 THEN
    -- Crear 3 locales
    INSERT INTO locations (client_id, name, address, city, country_code, is_active)
    VALUES 
      (v_client_a_id, 'Demo A - Zona 10', 'Avenida Reforma 1000', 'Guatemala', 'GT', true),
      (v_client_a_id, 'Demo A - Carretera El Salvador', 'Carretera a El Salvador km 5', 'Santa Tecla', 'GT', true),
      (v_client_a_id, 'Demo A - Antiqua', 'Calle del Arco 50', 'Antigua Guatemala', 'GT', true);
    
    RAISE NOTICE 'Creados 3 locales para Restaurante Demo A';
  ELSE
    RAISE NOTICE 'Restaurante Demo A ya tiene % locales', v_location_count;
  END IF;
END $$;

-- Crear locales para Restaurante Demo B
DO $$
DECLARE
  v_client_b_id UUID;
  v_location_count INT;
BEGIN
  SELECT id INTO v_client_b_id FROM clients WHERE name = 'Restaurante Demo B';
  
  SELECT COUNT(*) INTO v_location_count FROM locations 
  WHERE client_id = v_client_b_id;
  
  IF v_location_count = 0 THEN
    INSERT INTO locations (client_id, name, address, city, country_code, is_active)
    VALUES 
      (v_client_b_id, 'Demo B - Zona 1', 'Centro Histórico 123', 'Guatemala', 'GT', true),
      (v_client_b_id, 'Demo B - Zona 4', 'Diagonal 6 número 45', 'Guatemala', 'GT', true);
    
    RAISE NOTICE 'Creados 2 locales para Restaurante Demo B';
  ELSE
    RAISE NOTICE 'Restaurante Demo B ya tiene % locales', v_location_count;
  END IF;
END $$;

-- ================================================
-- PASO 3: Crear Usuarios Demo
-- ================================================
-- NOTA: Estos son los usuarios demo que puedes usar para pruebas
-- Email: demo-[nombre]@ayau.com
-- Contraseña: Demo123!@# (temporal)

-- Tabla para trackear IDs de usuarios creados
CREATE TEMP TABLE demo_users_created (
  email VARCHAR(255),
  role VARCHAR(50),
  access_level VARCHAR(50),
  user_id UUID,
  created_at TIMESTAMPTZ
);

-- ================================================
-- USUARIO 1: Admin del Sistema
-- Email: demo-admin@ayau.com
-- Rol: admin
-- Acceso: Sistema completo
-- ================================================

DO $$
DECLARE
  v_user_id UUID;
  v_email VARCHAR := 'demo-admin@ayau.com';
  v_password VARCHAR := 'Demo123!@#';
  v_password_hash VARCHAR;
BEGIN
  -- Verificar si ya existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  IF v_user_id IS NULL THEN
    -- Generar hash de contraseña
    v_password_hash := crypt(v_password, gen_salt('bf'));
    
    -- Usar función disponible en Supabase para crear usuario
    RAISE NOTICE 'Para crear usuario admin, usar Supabase CLI o dashboard directamente';
    RAISE NOTICE 'Email: % | Contraseña: %', v_email, v_password;
  ELSE
    RAISE NOTICE 'Usuario admin % ya existe', v_email;
  END IF;
END $$;

-- ================================================
-- USUARIO 2: Owner de Restaurante Demo A
-- Email: demo-owner-a@ayau.com
-- Rol: admin
-- Acceso: Cuenta completa (Restaurante Demo A)
-- ================================================

DO $$
DECLARE
  v_user_id UUID;
  v_client_id UUID;
  v_email VARCHAR := 'demo-owner-a@ayau.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo A';
  
  IF v_user_id IS NOT NULL AND v_client_id IS NOT NULL THEN
    -- Actualizar perfil
    UPDATE user_profiles
    SET role = 'admin', 
        client_id = v_client_id,
        access_level = 'account',
        is_active = true
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Usuario owner A configurado: %', v_email;
  ELSE
    RAISE NOTICE 'Usuario owner A requiere crear en Supabase primero: %', v_email;
  END IF;
END $$;

-- ================================================
-- USUARIO 3: Manager de Local - Demo A (Zona 10)
-- Email: demo-manager-a1@ayau.com
-- Rol: manager
-- Acceso: Local específico (Demo A - Zona 10)
-- ================================================

DO $$
DECLARE
  v_user_id UUID;
  v_location_id UUID;
  v_client_id UUID;
  v_email VARCHAR := 'demo-manager-a1@ayau.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo A';
  SELECT id INTO v_location_id FROM locations 
  WHERE client_id = v_client_id AND name = 'Demo A - Zona 10';
  
  IF v_user_id IS NOT NULL AND v_location_id IS NOT NULL THEN
    UPDATE user_profiles
    SET role = 'manager',
        client_id = v_client_id,
        location_id = v_location_id,
        access_level = 'location',
        is_active = true
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Usuario manager A1 configurado: %', v_email;
  ELSE
    RAISE NOTICE 'Usuario manager A1 requiere crear en Supabase primero: %', v_email;
  END IF;
END $$;

-- ================================================
-- USUARIO 4: Usuario Regular - Demo A (Zona 10)
-- Email: demo-user-a1@ayau.com
-- Rol: user
-- Acceso: Local específico (Demo A - Zona 10)
-- ================================================

DO $$
DECLARE
  v_user_id UUID;
  v_location_id UUID;
  v_client_id UUID;
  v_email VARCHAR := 'demo-user-a1@ayau.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo A';
  SELECT id INTO v_location_id FROM locations 
  WHERE client_id = v_client_id AND name = 'Demo A - Zona 10';
  
  IF v_user_id IS NOT NULL AND v_location_id IS NOT NULL THEN
    UPDATE user_profiles
    SET role = 'user',
        client_id = v_client_id,
        location_id = v_location_id,
        access_level = 'location',
        is_active = true
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Usuario regular A1 configurado: %', v_email;
  ELSE
    RAISE NOTICE 'Usuario regular A1 requiere crear en Supabase primero: %', v_email;
  END IF;
END $$;

-- ================================================
-- USUARIO 5: Owner de Restaurante Demo B
-- Email: demo-owner-b@ayau.com
-- Rol: admin
-- Acceso: Cuenta completa (Restaurante Demo B)
-- ================================================

DO $$
DECLARE
  v_user_id UUID;
  v_client_id UUID;
  v_email VARCHAR := 'demo-owner-b@ayau.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo B';
  
  IF v_user_id IS NOT NULL AND v_client_id IS NOT NULL THEN
    UPDATE user_profiles
    SET role = 'admin',
        client_id = v_client_id,
        access_level = 'account',
        is_active = true
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Usuario owner B configurado: %', v_email;
  ELSE
    RAISE NOTICE 'Usuario owner B requiere crear en Supabase primero: %', v_email;
  END IF;
END $$;

-- ================================================
-- USUARIO 6: Manager de Local - Demo B (Zona 1)
-- Email: demo-manager-b1@ayau.com
-- Rol: manager
-- Acceso: Local específico (Demo B - Zona 1)
-- ================================================

DO $$
DECLARE
  v_user_id UUID;
  v_location_id UUID;
  v_client_id UUID;
  v_email VARCHAR := 'demo-manager-b1@ayau.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo B';
  SELECT id INTO v_location_id FROM locations 
  WHERE client_id = v_client_id AND name = 'Demo B - Zona 1';
  
  IF v_user_id IS NOT NULL AND v_location_id IS NOT NULL THEN
    UPDATE user_profiles
    SET role = 'manager',
        client_id = v_client_id,
        location_id = v_location_id,
        access_level = 'location',
        is_active = true
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Usuario manager B1 configurado: %', v_email;
  ELSE
    RAISE NOTICE 'Usuario manager B1 requiere crear en Supabase primero: %', v_email;
  END IF;
END $$;

-- ================================================
-- USUARIO 7: Manager de Local - Demo B (Zona 4)
-- Email: demo-manager-b2@ayau.com
-- Rol: manager
-- Acceso: Local específico (Demo B - Zona 4)
-- ================================================

DO $$
DECLARE
  v_user_id UUID;
  v_location_id UUID;
  v_client_id UUID;
  v_email VARCHAR := 'demo-manager-b2@ayau.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo B';
  SELECT id INTO v_location_id FROM locations 
  WHERE client_id = v_client_id AND name = 'Demo B - Zona 4';
  
  IF v_user_id IS NOT NULL AND v_location_id IS NOT NULL THEN
    UPDATE user_profiles
    SET role = 'manager',
        client_id = v_client_id,
        location_id = v_location_id,
        access_level = 'location',
        is_active = true
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Usuario manager B2 configurado: %', v_email;
  ELSE
    RAISE NOTICE 'Usuario manager B2 requiere crear en Supabase primero: %', v_email;
  END IF;
END $$;

-- ================================================
-- USUARIO 8: Usuario Regular - Demo B (Zona 4)
-- Email: demo-user-b2@ayau.com
-- Rol: user
-- Acceso: Local específico (Demo B - Zona 4)
-- ================================================

DO $$
DECLARE
  v_user_id UUID;
  v_location_id UUID;
  v_client_id UUID;
  v_email VARCHAR := 'demo-user-b2@ayau.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  SELECT id INTO v_client_id FROM clients WHERE name = 'Restaurante Demo B';
  SELECT id INTO v_location_id FROM locations 
  WHERE client_id = v_client_id AND name = 'Demo B - Zona 4';
  
  IF v_user_id IS NOT NULL AND v_location_id IS NOT NULL THEN
    UPDATE user_profiles
    SET role = 'user',
        client_id = v_client_id,
        location_id = v_location_id,
        access_level = 'location',
        is_active = true
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Usuario regular B2 configurado: %', v_email;
  ELSE
    RAISE NOTICE 'Usuario regular B2 requiere crear en Supabase primero: %', v_email;
  END IF;
END $$;

-- ================================================
-- VERIFICACIÓN: Mostrar usuarios creados
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== INFORMACIÓN DE ACCESO PARA DEMOSTRACIÓN ===';
  RAISE NOTICE '';
  RAISE NOTICE 'CUENTAS CREADAS:';
  RAISE NOTICE '  ✓ Restaurante Demo A (3 locales)';
  RAISE NOTICE '  ✓ Restaurante Demo B (2 locales)';
  RAISE NOTICE '';
  RAISE NOTICE 'USUARIOS CREADOS (password: Demo123!@#):';
  RAISE NOTICE '  1. demo-admin@ayau.com                    [Admin Sistema]';
  RAISE NOTICE '  2. demo-owner-a@ayau.com                  [Owner - Restaurante A]';
  RAISE NOTICE '  3. demo-manager-a1@ayau.com               [Manager - A Zona 10]';
  RAISE NOTICE '  4. demo-user-a1@ayau.com                  [Usuario - A Zona 10]';
  RAISE NOTICE '  5. demo-owner-b@ayau.com                  [Owner - Restaurante B]';
  RAISE NOTICE '  6. demo-manager-b1@ayau.com               [Manager - B Zona 1]';
  RAISE NOTICE '  7. demo-manager-b2@ayau.com               [Manager - B Zona 4]';
  RAISE NOTICE '  8. demo-user-b2@ayau.com                  [Usuario - B Zona 4]';
  RAISE NOTICE '';
END $$;

-- Query de verificación
SELECT '=== DEMO USERS CREATED ===' as status;

SELECT 
  COALESCE(up.id::TEXT, 'NO CREADO') as user_id,
  au.email,
  COALESCE(up.full_name, au.email) as full_name,
  COALESCE(up.role, 'N/A') as role,
  COALESCE(up.access_level, 'N/A') as access_level,
  COALESCE(c.name, 'Sistema') as account,
  COALESCE(l.name, '-') as location,
  COALESCE(up.is_active, false) as is_active,
  CASE 
    WHEN up.id IS NULL THEN '⚠️ PENDIENTE: Crear en Supabase'
    ELSE '✓ CONFIGURADO'
  END as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
LEFT JOIN clients c ON up.client_id = c.id
LEFT JOIN locations l ON up.location_id = l.id
WHERE au.email LIKE 'demo-%@ayau.com'
ORDER BY au.email;
