# Guía de Configuración de Base de Datos - AYAU

Esta guía detalla cómo configurar la base de datos de Supabase para la plataforma AYAU desde cero.

## 📋 Pre-requisitos

1. Cuenta de Supabase creada
2. Proyecto de Supabase creado
3. Acceso al SQL Editor en Supabase Dashboard

## 🔧 Orden de Ejecución de Scripts

**IMPORTANTE**: Los scripts deben ejecutarse en el orden específico que se muestra a continuación. Cada script depende de los anteriores.

### 1. Schema Principal

**Archivo**: `database/supabase-schema-reportes.sql`

Este script crea todas las tablas base del sistema:

- `user_profiles` - Perfiles de usuarios con roles
- `playlists` - Catálogo de playlists
- `songs` - Catálogo de canciones
- `playlist_songs` - Relación entre playlists y canciones
- `play_history` - Historial de reproducción para regalías
- `user_playlist_permissions` - Permisos de usuarios a playlists específicas

**Cómo ejecutar**:
1. Abrir SQL Editor en Supabase Dashboard
2. Copiar y pegar todo el contenido de `database/supabase-schema-reportes.sql`
3. Click en "Run" o presionar Ctrl/Cmd + Enter
4. Verificar que todas las tablas se crearon correctamente

### 2. Sistema de Roles y Permisos

**Archivo**: `database/setup-manager-permissions.sql`

Este script configura el sistema de roles (admin, manager, user) y las políticas de Row Level Security (RLS).

**Funciones creadas**:
- `is_admin()` - Verifica si el usuario actual es admin
- `is_manager_or_admin()` - Verifica si el usuario actual es admin o manager

**Políticas RLS creadas**:
- Políticas para `playlists` (SELECT, INSERT, UPDATE, DELETE)
- Políticas para `playlist_songs` (SELECT, INSERT, DELETE)
- Políticas para `songs` (SELECT, INSERT, UPDATE, DELETE)

**Permisos por rol**:

| Acción | Admin | Manager | User |
|--------|-------|---------|------|
| Ver playlists | ✅ Todas | ✅ Todas | ✅ Asignadas |
| Crear playlists | ✅ | ✅ | ❌ |
| Editar playlists | ✅ | ✅ | ❌ |
| Eliminar playlists | ✅ | ❌ | ❌ |
| Ver canciones | ✅ | ✅ | ✅ |
| Crear canciones | ✅ | ✅ | ❌ |
| Editar canciones | ✅ | ✅ | ❌ |
| Eliminar canciones | ✅ | ✅ | ❌ |
| Ver usuarios | ✅ Todos | ❌ | ❌ Solo su perfil |
| Crear usuarios | ✅ | ❌ | ❌ |
| Editar usuarios | ✅ | ❌ | ❌ |

**Cómo ejecutar**:
1. En SQL Editor, copiar y pegar el contenido de `database/setup-manager-permissions.sql`
2. Ejecutar el script
3. Verificar que las funciones fueron creadas:
```sql
SELECT proname FROM pg_proc WHERE proname IN ('is_admin', 'is_manager_or_admin');
```

### 3. Trigger de Creación de Usuarios

**Archivo**: `database/setup-create-user-function.sql`

Este script crea un trigger que automáticamente crea un perfil en `user_profiles` cuando se registra un nuevo usuario en `auth.users`.

**Función creada**:
- `handle_new_user()` - Trigger function que se ejecuta al crear un usuario

**Cómo ejecutar**:
1. Copiar y pegar el contenido de `database/setup-create-user-function.sql`
2. Ejecutar el script
3. Verificar que el trigger fue creado:
```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

### 4. Sincronización de Email

**Archivo**: `database/add-email-to-profiles.sql`

Este script agrega la columna `email` a `user_profiles` y crea un sistema de sincronización automática con `auth.users`.

**Funcionalidad**:
- Agrega columna `email` a `user_profiles` si no existe
- Copia emails existentes de `auth.users` a `user_profiles`
- Crea función `sync_user_email()` para mantener emails sincronizados
- Actualiza `handle_new_user()` para incluir email en nuevos perfiles

**Cómo ejecutar**:
1. Copiar y pegar el contenido de `database/add-email-to-profiles.sql`
2. Ejecutar el script
3. Verificar que se agregó la columna:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'email';
```

### 5. Configuración de Storage (Opcional)

**Archivo**: `database/setup-storage.sql`

Este script configura el bucket de Supabase Storage para almacenar archivos de audio.

**Si no tienes este archivo**, puedes configurar storage manualmente:

1. Ir a Storage en Supabase Dashboard
2. Crear un nuevo bucket llamado `audio-files`
3. Configurar como público o privado según necesites
4. Configurar políticas de acceso

O crear el script manualmente:

```sql
-- Crear bucket para archivos de audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true)
ON CONFLICT (id) DO NOTHING;

-- Política: Cualquiera puede leer archivos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-files');

-- Política: Solo admins y managers pueden subir
CREATE POLICY "Admin and Manager Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-files' AND
  auth.role() = 'authenticated' AND
  public.is_manager_or_admin() = true
);

-- Política: Solo admins y managers pueden eliminar
CREATE POLICY "Admin and Manager Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-files' AND
  public.is_manager_or_admin() = true
);
```

## 🔍 Scripts de Diagnóstico (Opcional)

Estos scripts son útiles para solucionar problemas pero no son necesarios para la configuración inicial.

### database/diagnose-and-fix-users.sql

**Cuándo usar**:
- Cuando usuarios creados no aparecen en la lista
- Cuando hay inconsistencias entre `auth.users` y `user_profiles`
- Para verificar políticas RLS

**Qué hace**:
- Muestra todos los usuarios en `auth.users`
- Muestra todos los perfiles en `user_profiles`
- Muestra políticas actuales
- Crea perfiles faltantes para usuarios existentes
- Elimina y recrea políticas RLS para `user_profiles`

### database/fix-user-profiles-policies.sql

**Cuándo usar**:
- Cuando admins no pueden ver la lista completa de usuarios
- Para corregir solo las políticas sin modificar datos

**Qué hace**:
- Elimina políticas RLS antiguas o incorrectas
- Crea políticas correctas que permiten a admins ver todos los usuarios

## ✅ Verificación de Instalación

Después de ejecutar todos los scripts, verifica que todo esté configurado correctamente:

### 1. Verificar tablas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver:
- `playlist_songs`
- `playlists`
- `play_history`
- `songs`
- `user_playlist_permissions`
- `user_profiles`

### 2. Verificar funciones

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname IN ('is_admin', 'is_manager_or_admin', 'handle_new_user', 'sync_user_email')
ORDER BY proname;
```

Deberías ver las 4 funciones listadas.

### 3. Verificar triggers

```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname IN ('on_auth_user_created', 'on_auth_user_email_update')
ORDER BY tgname;
```

Deberías ver ambos triggers.

### 4. Verificar políticas RLS

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Deberías ver políticas para:
- `playlists` (4 políticas: SELECT, INSERT, UPDATE, DELETE)
- `playlist_songs` (3 políticas: SELECT, INSERT, DELETE)
- `songs` (4 políticas: SELECT, INSERT, UPDATE, DELETE)
- `user_profiles` (4 políticas: SELECT, INSERT, UPDATE, DELETE)

### 5. Verificar RLS habilitado

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

La columna `rowsecurity` debe ser `true` para todas las tablas.

## 🎯 Crear Usuario Admin Inicial

Después de configurar la base de datos:

1. **Ir a Authentication** en Supabase Dashboard
2. **Add User** → **Create new user**
3. Ingresar:
   - Email: tu_email@ejemplo.com
   - Password: (una contraseña segura)
   - Auto Confirm: ✅ (marcar)

4. **Actualizar rol a admin** en SQL Editor:

```sql
-- Encontrar el ID del usuario recién creado
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Actualizar su rol a admin
UPDATE user_profiles
SET role = 'admin'
WHERE id = 'id_del_usuario_aqui';

-- Verificar
SELECT id, full_name, email, role, is_active
FROM user_profiles
WHERE role = 'admin';
```

## 🐛 Solución de Problemas Comunes

### Error: "function public.is_admin() does not exist"

**Causa**: El script `database/setup-manager-permissions.sql` no se ejecutó correctamente.

**Solución**: Ejecutar nuevamente `database/setup-manager-permissions.sql` completo.

### Error: "relation 'user_profiles' does not exist"

**Causa**: El schema principal no se ejecutó.

**Solución**: Ejecutar `database/supabase-schema-reportes.sql` primero.

### Los usuarios creados no tienen perfil

**Causa**: El trigger no se creó o no está funcionando.

**Solución**:
1. Ejecutar `database/setup-create-user-function.sql`
2. Si ya hay usuarios sin perfil, ejecutar `database/diagnose-and-fix-users.sql`

### Admin no puede ver otros usuarios

**Causa**: Políticas RLS incorrectas.

**Solución**: Ejecutar `database/fix-user-profiles-policies.sql`

### Error al subir archivos de audio

**Causa**: Storage no configurado o políticas incorrectas.

**Solución**:
1. Verificar que el bucket `audio-files` existe
2. Verificar políticas de storage
3. Ejecutar el script de configuración de storage

## 📊 Estructura de RLS

El sistema usa Row Level Security (RLS) para asegurar los datos:

```
┌─────────────────────────────────────────────────┐
│  Usuario hace request                           │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Supabase verifica auth.uid()                   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Ejecuta is_admin() o is_manager_or_admin()     │
│  (con SECURITY DEFINER para evitar recursión)   │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Políticas RLS filtran resultados:              │
│  - Admin: ve todo                               │
│  - Manager: ve lo permitido                     │
│  - User: solo sus datos                         │
└─────────────────────────────────────────────────┘
```

## 🔐 Mejores Prácticas de Seguridad

1. **Nunca deshabilitar RLS** en tablas de producción
2. **Usar SECURITY DEFINER** en funciones que consultan user_profiles para evitar recursión
3. **Validar permisos** tanto en frontend como en backend (RLS)
4. **Usar roles específicos** (admin, manager, user) en lugar de permisos booleanos genéricos
5. **Auditar cambios** en user_profiles (considerar agregar tabla de auditoría)

## 📚 Referencias

- [Documentación de Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Policies](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

---

Para más información, consulta [README.md](README.md) o [PLAN-IMPLEMENTACION.md](PLAN-IMPLEMENTACION.md).
