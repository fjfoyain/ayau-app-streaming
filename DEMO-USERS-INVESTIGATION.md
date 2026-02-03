# 🔍 Investigación: Por Qué Los Usuarios Demo No Aparecen en la UI

## Resumen Ejecutivo

Los usuarios demo **SÍ se crearon en la base de datos**, pero:
- ❌ No aparecen en la UI de UserManager
- ⚠️ Las cuentas y locales SÍ se crearon correctamente
- ⚠️ El script SQL configura perfiles, pero **los usuarios deben existir primero en `auth.users`**

---

## 🔗 Cadena de Relaciones

```
auth.users (Supabase Auth Table)
         ↓ Foreign Key
user_profiles (Tabla Local)
         ↓
Visible en UI
```

### El Problema

El script `create-demo-users.sql` hace esto:

```sql
DO $$
DECLARE
  v_user_id UUID;
  v_email VARCHAR := 'demo-owner-a@ayau.com';
BEGIN
  -- PASO 1: Busca usuario existente en auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  
  -- PASO 2: Si no existe, SOLO INFORMA (no lo crea)
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuario requiere crear en Supabase primero: %', v_email;
  ELSE
    -- PASO 3: Si existe, actualiza su perfil
    UPDATE user_profiles
    SET role = 'admin', 
        client_id = v_client_id,
        access_level = 'account',
        is_active = true
    WHERE id = v_user_id;
  END IF;
END $$;
```

### Restricción de Supabase

**No es posible crear usuarios en `auth.users` directamente desde SQL** porque:
- `auth.users` es controlada por el sistema de autenticación de Supabase
- Supabase Auth maneja encriptación de contraseñas, verificación de email, etc.
- Intentar INSERT directo viola políticas de seguridad

---

## ✅ Solución 1: Crear Demo Users Manualmente (Rápido)

### Opción A: Supabase Dashboard
1. Ir a `Authentication` → `Users`
2. Click en `+ Add user`
3. Crear 8 usuarios con emails:
   - demo-admin@ayau.com
   - demo-owner-a@ayau.com
   - demo-manager-a1@ayau.com
   - demo-user-a1@ayau.com
   - demo-owner-b@ayau.com
   - demo-manager-b1@ayau.com
   - demo-manager-b2@ayau.com
   - demo-user-b2@ayau.com
4. Confirmar emails o marcar como verificados
5. Los perfiles se configurarán automáticamente con el script

### Opción B: Supabase CLI

```bash
# Crear usuario
supabase auth add-user \
  --email demo-owner-a@ayau.com \
  --password "Demo123!@#"
```

---

## 🚀 Solución 2: Script Automático de Provisioning (Recomendado)

### Crear Edge Function en Supabase

**Archivo:** `supabase/functions/create-demo-users/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const supabase = createClient(supabaseUrl, supabaseKey)

interface DemoUser {
  email: string
  password: string
  role: "admin" | "manager" | "user"
  access_level: "account" | "location" | null
  account?: string
  location?: string
}

const demoUsers: DemoUser[] = [
  {
    email: "demo-admin@ayau.com",
    password: "Demo123!@#",
    role: "admin",
    access_level: null,
  },
  {
    email: "demo-owner-a@ayau.com",
    password: "Demo123!@#",
    role: "admin",
    access_level: "account",
    account: "Restaurante Demo A",
  },
  {
    email: "demo-manager-a1@ayau.com",
    password: "Demo123!@#",
    role: "manager",
    access_level: "location",
    account: "Restaurante Demo A",
    location: "Demo A - Zona 10",
  },
  {
    email: "demo-user-a1@ayau.com",
    password: "Demo123!@#",
    role: "user",
    access_level: "location",
    account: "Restaurante Demo A",
    location: "Demo A - Zona 10",
  },
  {
    email: "demo-owner-b@ayau.com",
    password: "Demo123!@#",
    role: "admin",
    access_level: "account",
    account: "Restaurante Demo B",
  },
  {
    email: "demo-manager-b1@ayau.com",
    password: "Demo123!@#",
    role: "manager",
    access_level: "location",
    account: "Restaurante Demo B",
    location: "Demo B - Zona 1",
  },
  {
    email: "demo-manager-b2@ayau.com",
    password: "Demo123!@#",
    role: "manager",
    access_level: "location",
    account: "Restaurante Demo B",
    location: "Demo B - Zona 4",
  },
  {
    email: "demo-user-b2@ayau.com",
    password: "Demo123!@#",
    role: "user",
    access_level: "location",
    account: "Restaurante Demo B",
    location: "Demo B - Zona 4",
  },
]

serve(async (req) => {
  try {
    // Verificar método POST
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    const results = []

    for (const demoUser of demoUsers) {
      try {
        // 1. Crear usuario en auth.users
        const { data, error } = await supabase.auth.admin.createUser({
          email: demoUser.email,
          password: demoUser.password,
          email_confirm: true,
        })

        if (error) {
          results.push({
            email: demoUser.email,
            success: false,
            error: error.message,
          })
          continue
        }

        const userId = data.user.id

        // 2. Obtener IDs de cuenta y local
        let clientId = null
        let locationId = null

        if (demoUser.account) {
          const { data: clientData } = await supabase
            .from("clients")
            .select("id")
            .eq("name", demoUser.account)
            .single()

          if (clientData) clientId = clientData.id
        }

        if (demoUser.location && clientId) {
          const { data: locationData } = await supabase
            .from("locations")
            .select("id")
            .eq("client_id", clientId)
            .eq("name", demoUser.location)
            .single()

          if (locationData) locationId = locationData.id
        }

        // 3. Crear/actualizar perfil
        await supabase.from("user_profiles").upsert(
          {
            id: userId,
            email: demoUser.email,
            role: demoUser.role,
            access_level: demoUser.access_level,
            client_id: clientId,
            location_id: locationId,
            is_active: true,
          },
          { onConflict: "id" }
        )

        results.push({
          email: demoUser.email,
          success: true,
          userId: userId,
        })
      } catch (error) {
        results.push({
          email: demoUser.email,
          success: false,
          error: error.message,
        })
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
```

### Uso:

```bash
# Desplegar Edge Function
supabase functions deploy create-demo-users

# Ejecutar
curl -X POST https://[project-id].supabase.co/functions/v1/create-demo-users \
  -H "Authorization: Bearer [ANON_KEY]"
```

---

## 🛠️ Solución 3: Función SQL Mejorada (Alternativa)

**Archivo:** `database/create-demo-users-v2.sql`

```sql
-- Crear función auxiliar para crear demo users
CREATE OR REPLACE FUNCTION public.create_demo_users()
RETURNS TABLE(email TEXT, status TEXT) AS $$
DECLARE
  v_user_id UUID;
  v_client_a_id UUID;
  v_client_b_id UUID;
  v_location_id UUID;
  demo_user RECORD;
BEGIN
  -- Verificar si ya existen
  IF EXISTS (SELECT 1 FROM auth.users WHERE email LIKE 'demo-%@ayau.com') THEN
    RETURN QUERY SELECT 'demo-admin@ayau.com'::TEXT, 'Ya existen usuarios demo'::TEXT;
    RETURN;
  END IF;

  -- Obtener IDs de cuentas
  SELECT id INTO v_client_a_id FROM clients WHERE name = 'Restaurante Demo A';
  SELECT id INTO v_client_b_id FROM clients WHERE name = 'Restaurante Demo B';

  -- Array de usuarios a crear
  FOR demo_user IN SELECT * FROM (VALUES
    ('demo-admin@ayau.com'::TEXT, 'admin'::VARCHAR, NULL::VARCHAR),
    ('demo-owner-a@ayau.com', 'admin', 'account'),
    ('demo-manager-a1@ayau.com', 'manager', 'location'),
    ('demo-user-a1@ayau.com', 'user', 'location')
  ) AS t(email, role, access_level) LOOP
    -- La creación real ocurre en la app via supabase.auth.signUp()
    RETURN QUERY SELECT 
      demo_user.email,
      'Instrucción: Crear en Supabase Dashboard o CLI'::TEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 📋 Checklist de Implementación

### Estado Actual
- [x] Cuentas Demo creadas (Restaurante Demo A, B)
- [x] Locales Demo creados (5 en total)
- [ ] Usuarios Demo creados en auth.users
- [ ] Usuarios Demo vinculados en user_profiles
- [ ] Verificación en UI

### Paso a Paso

**Opción Recomendada:**

1. **Crear usuarios manualmente en Supabase Dashboard** (5 minutos)
   ```
   Ir a Authentication → Users → Add User
   Crear 8 usuarios con los emails listados
   ```

2. **Ejecutar script de verificación**
   ```sql
   SELECT * FROM public.verify_demo_users();
   ```

3. **Verificar en UI**
   - Ir a Admin → User Manager
   - Debería ver los 8 usuarios

---

## 🔍 Verificación

### Query para Revisar Estado Actual

```sql
-- VER TODOS LOS USUARIOS DEMO
SELECT 
  COALESCE(au.email, 'NO CREADO') as email,
  COALESCE(up.full_name, '-') as full_name,
  COALESCE(up.role, '-') as role,
  COALESCE(up.access_level, '-') as access_level,
  COALESCE(c.name, '-') as account,
  COALESCE(l.name, '-') as location,
  COALESCE(up.is_active, false) as is_active,
  CASE 
    WHEN au.id IS NULL THEN '❌ Sin crear en auth.users'
    WHEN up.id IS NULL THEN '⚠️ Sin perfil'
    ELSE '✅ LISTO'
  END as status
FROM (
  VALUES 
    ('demo-admin@ayau.com'),
    ('demo-owner-a@ayau.com'),
    ('demo-manager-a1@ayau.com'),
    ('demo-user-a1@ayau.com'),
    ('demo-owner-b@ayau.com'),
    ('demo-manager-b1@ayau.com'),
    ('demo-manager-b2@ayau.com'),
    ('demo-user-b2@ayau.com')
) AS emails(email)
LEFT JOIN auth.users au ON emails.email = au.email
LEFT JOIN user_profiles up ON au.id = up.id
LEFT JOIN clients c ON up.client_id = c.id
LEFT JOIN locations l ON up.location_id = l.id
ORDER BY emails.email;
```

---

## 🎯 Resumen de Soluciones

| Solución | Tiempo | Complejidad | Automatización |
|----------|--------|-------------|-----------------|
| Dashboard Manual | 5 min | ⭐ Baja | ❌ Manual |
| CLI Supabase | 10 min | ⭐⭐ Media | ⭐ Parcial |
| Edge Function | 20 min | ⭐⭐⭐ Alta | ✅ Automática |

**Recomendación:** Usar Dashboard manual para ahora, luego implementar Edge Function para automatizar en futuro.

---

## 📝 Notas Importantes

1. **Los perfiles se crean automáticamente** cuando se ejecuta el trigger `handle_new_user()` al crear usuario en Supabase
2. **El script SQL solo actualiza perfiles existentes** - no crea usuarios nuevos
3. **Las contraseñas son temporales** - usuarios deben cambiarla al primer login
4. **Email de confirmación es enviado por Supabase** - no lo controla AYAU

---

## 🚨 Si Aún No Aparecen en la UI

### Checklist de Debugging

1. ✅ ¿Usuarios creados en Supabase Auth?
   ```sql
   SELECT email, confirmed_at FROM auth.users WHERE email LIKE 'demo-%@ayau.com';
   ```

2. ✅ ¿Perfiles creados en user_profiles?
   ```sql
   SELECT * FROM user_profiles WHERE id IN (
     SELECT id FROM auth.users WHERE email LIKE 'demo-%@ayau.com'
   );
   ```

3. ✅ ¿Cuentas y locales existen?
   ```sql
   SELECT * FROM clients WHERE name LIKE 'Restaurante Demo%';
   SELECT * FROM locations WHERE name LIKE 'Demo%';
   ```

4. ✅ ¿RLS permite lectura?
   ```sql
   -- Ejecutar como usuario logueado
   SELECT * FROM user_profiles LIMIT 1;
   ```

5. ✅ ¿Frontend hace refetch?
   - Limpiar localStorage: `localStorage.clear()`
   - Cerrar sesión y login de nuevo
   - Hard refresh: `Cmd+Shift+R` (Mac) o `Ctrl+Shift+R` (Windows)

---

**Última Actualización:** Febrero 2, 2026  
**Versión:** 1.0
