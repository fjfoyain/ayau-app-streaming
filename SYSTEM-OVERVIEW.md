# 🎵 AYAU - Especificación Completa del Sistema

## 📋 Índice
1. [Arquitectura General](#arquitectura-general)
2. [Módulos de Usuarios](#módulos-de-usuarios)
3. [Funcionalidad de Playback](#funcionalidad-de-playback)
4. [Gestión de Playlists](#gestión-de-playlists)
5. [Sistema de Reportes](#sistema-de-reportes)
6. [Seguridad y RLS](#seguridad-y-rls)
7. [Usuarios Demo](#usuarios-demo)
8. [Nuevas Características Implementadas](#nuevas-características-implementadas)

---

## 🏗️ Arquitectura General

### Stack Tecnológico
- **Frontend:** React 18 + Vite
- **Backend:** Supabase (PostgreSQL + Auth)
- **Estilos:** Material-UI (MUI)
- **Context:** PlayerContext + SyncPlaybackContext
- **Rutas:** React Router v6

### Estructura de Datos Principal

```
auth.users (Supabase Auth)
    ↓
user_profiles (Tabla local con metadata)
    ├─ client_id (FK → clients)
    ├─ location_id (FK → locations)
    ├─ role (admin|manager|user)
    └─ access_level (account|location|NULL)

clients (Cuentas/Empresas)
    ├─ owner_id (FK → auth.users)
    ├─ playback_mode (independent|shared_playlist|synchronized)
    └─ locations
        ├─ manager_id (FK → auth.users)
        └─ users

playlists
    ├─ songs
    └─ playlist_permissions (usuarios + nivel de acceso)

playback_sessions
    ├─ client_id
    ├─ is_centralized (boolean)
    ├─ playback_mode
    └─ controlled_by (usuario actual controlador)

play_history (registros de reproducción)
```

---

## 👥 Módulos de Usuarios

### 1. Tabla user_profiles

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name VARCHAR(255),
  role VARCHAR(50),                -- admin|manager|user
  access_level VARCHAR(50),        -- account|location|NULL
  client_id UUID,                  -- Si tiene acceso a nivel de cuenta
  location_id UUID,                -- Si tiene acceso a nivel de local
  is_active BOOLEAN,
  email TEXT (sincronizado con auth.users),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 2. Roles y Niveles de Acceso

| Rol | access_level | Acceso | Funciones |
|-----|--------------|--------|-----------|
| **admin** | NULL | Sistema completo | Todo |
| **manager** | account | Toda una cuenta (clientes) | Crear usuarios, editar, playback |
| **manager** | location | Un local específico | Controlar música, ver reportes |
| **user** | location | Un local específico | Ver playlists, reproducir |
| **user** | NULL | Usuario sin asignación | Solo perfil |

### 3. Ciclo de Vida de Usuarios

#### A. Creación de Usuario (Nuevo Flujo)
```
Admin → UserManager.jsx
         ↓
      handleCreateUser()
         ↓
      Genera contraseña temporal (12 chars)
         ↓
      supabase.auth.signUp()
         ↓
      Trigger: handle_new_user()
         ↓
      INSERT user_profiles
         ↓
      Modal muestra contraseña
         ↓
      Email de confirmación enviado
```

#### B. Recuperación de Contraseña (Nuevo Flujo)
```
Usuario → Login
   ↓
"¿Olvidaste tu contraseña?"
   ↓
PasswordReset.jsx
   ↓
Ingresa email
   ↓
requestPasswordReset(email)
   ↓
Genera token (24h)
   ↓
INSERT password_reset_tokens
   ↓
Email con enlace
   ↓
/password-reset?token=XXX
   ↓
validateResetToken()
   ↓
Formulario nueva contraseña
   ↓
completePasswordReset()
   ↓
UPDATE auth.users encrypted_password
   ↓
Login exitoso
```

### 4. Funciones Nuevas de Password Reset

#### A. generate_reset_token()
- Genera token aleatorio de 32 caracteres
- Usado por request_password_reset()

#### B. request_password_reset(email)
- Busca usuario por email
- Crea token con expiración de 24h
- Retorna resultado JSON
- **Seguridad:** Respuesta silenciosa (no revela si email existe)

#### C. validate_reset_token(token)
- Verifica que token sea válido y no esté expirado
- Retorna user_id si es válido, NULL si no
- Consulta en password_reset_tokens

#### D. complete_password_reset(token, new_password)
- Valida token
- Actualiza contraseña en auth.users (con crypt/bcrypt)
- Marca token como usado (used_at = NOW())
- Token no puede reutilizarse

### 5. API JavaScript Nuevas

```javascript
// requestPasswordReset(email)
// Retorna: { success, message, token, expires_at }

// validateResetToken(token)
// Retorna: boolean

// completePasswordReset(token, newPassword)
// Retorna: { success, message }
```

---

## 🎵 Funcionalidad de Playback

### 1. Tabla playback_sessions

```sql
CREATE TABLE playback_sessions (
  id UUID PRIMARY KEY,
  client_id UUID UNIQUE REFERENCES clients(id),
  is_centralized BOOLEAN DEFAULT false,  -- Control centralizado
  current_song_id UUID,
  current_playlist_id UUID,
  playback_state VARCHAR(20),             -- 'playing'|'paused'|'stopped'
  playback_position INTEGER,              -- Segundos
  volume INTEGER,                         -- 0-100
  controlled_by UUID,                     -- Usuario controlador
  updated_at TIMESTAMPTZ
);
```

### 2. Modos de Playback

#### A. Independent (Independiente)
```
Cliente con 3 locales
    ↓
Cada local controla su música
    ↓
Sin sincronización
    ↓
playback_mode: 'independent'
is_centralized: false
```

#### B. Shared_Playlist (Playlist Compartida)
```
Cliente con 3 locales
    ↓
Mismos playlists en todos
    ↓
Pero reproducción independiente
    ↓
playback_mode: 'shared_playlist'
```

#### C. Synchronized (Sincronizado)
```
Cliente con 3 locales
    ↓
Un controlador (manager/admin)
    ↓
Todos los locales reproducen lo mismo
    ↓
playback_mode: 'synchronized'
is_centralized: true
controlled_by: [user_id]
```

### 3. Contexto de Sincronización

**Archivo:** `src/context/SyncPlaybackContext.jsx`

```javascript
const initialState = {
  clientId: null,
  playbackMode: 'independent',  // 'independent' | 'shared_playlist' | 'synchronized'
  isController: false,
  // ... más estado
};

// Acciones
- SET_PLAYBACK_MODE
- SET_CLIENT_ID
- SET_CONTROLLER_STATUS
- UPDATE_PLAYBACK_STATE
- SYNC_TO_REMOTE
```

### 4. Componentes de Playback

| Componente | Función | Relación |
|-----------|---------|----------|
| `MusicPlayer.jsx` | Reproductor principal | Integra SyncStatusIndicator |
| `SyncStatusIndicator.jsx` | Muestra modo sync | Solo visible en 'synchronized' |
| `DJModePanel.jsx` | Panel de control para DJ | Solo para controlador |
| `SyncPlaybackProvider` | Proveedor de contexto | Envuelve rutas |

### 5. Control de Playback

```javascript
// Solo disponible en modo 'synchronized'
if (state.playbackMode === 'synchronized' && state.isController) {
  // Permitir control
  - play()
  - pause()
  - next()
  - previous()
  - setVolume()
}
```

---

## 🎼 Gestión de Playlists

### 1. Tabla playlists

```sql
CREATE TABLE playlists (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 2. Tabla playlist_songs

```sql
CREATE TABLE playlist_songs (
  id UUID PRIMARY KEY,
  playlist_id UUID REFERENCES playlists(id),
  song_id UUID REFERENCES songs(id),
  position INTEGER,  -- Orden en playlist
  added_at TIMESTAMPTZ,
  UNIQUE(playlist_id, song_id)
);
```

### 3. Tabla playlist_permissions

```sql
CREATE TABLE playlist_permissions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  playlist_id UUID REFERENCES playlists(id),
  permission_level VARCHAR(20),  -- 'view'|'edit'|'admin'
  created_at TIMESTAMPTZ
);
```

### 4. Tabla songs (Campos Críticos para Regalías)

```sql
CREATE TABLE songs (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  performer VARCHAR(255),         -- Intérprete
  author VARCHAR(255),            -- Compositor
  duration INTEGER,               -- Segundos (CRÍTICO)
  file_url TEXT,
  cover_image_url TEXT,
  isrc VARCHAR(12),               -- International Standard Recording Code
  iswc VARCHAR(15),               -- Standard Musical Work Code
  ipi VARCHAR(11),                -- Interested Parties Information
  code VARCHAR(50),               -- Código interno
  genre VARCHAR(100),
  release_year INTEGER,
  label VARCHAR(255),
  version VARCHAR(50),
  created_at TIMESTAMPTZ
);
```

### 5. Funciones de API para Playlists

```javascript
// Obtener playlists del usuario (RLS filtra automáticamente)
export const getUserPlaylists = async ()

// Obtener canciones de playlist con URLs firmadas
export const getPlaylistSongs = async (playlistId)

// Asignar playlist a usuario
export const assignPlaylistToUser = async (userId, playlistId, permissionLevel)

// Remover permiso de playlist
export const removePlaylistFromUser = async (userId, playlistId)

// Obtener permisos de usuario
export const getUserPermissions = async (userId)
```

---

## 📊 Sistema de Reportes

### 1. Tabla play_history (Crítica para Regalías)

```sql
CREATE TABLE play_history (
  id UUID PRIMARY KEY,
  user_id UUID,
  song_id UUID,
  playlist_id UUID,
  location_id UUID,           -- NUEVO: para reportes por local
  client_id UUID,             -- NUEVO: para reportes por cuenta
  stream_duration INTEGER,    -- CRÍTICO: Segundos reproducidos
  completed BOOLEAN,          -- ¿Se completó la canción?
  played_at TIMESTAMPTZ,
  country_code VARCHAR(2) DEFAULT 'GT'
);
```

### 2. Funciones de Reporte

```javascript
// Registrar reproducción
export const recordPlay = async (userId, songId, playlistId, durationInSeconds)

// Obtener analytics por cuenta
export const getAnalyticsByAccount = async (accountId)

// Obtener analytics por local
export const getAnalyticsByVenue = async (venueId)

// Obtener top canciones
export const getTopSongs = async (startDate, endDate, venueId)
```

### 3. Analytics Disponibles

- **Por Cuenta:** Total plays, top canciones, usuarios activos
- **Por Local:** Reproducción por hora/día, preferencias
- **Por Usuario:** Historial completo, duración de reproducción
- **Por Canción:** Reproducciones, ingresos estimados

---

## 🔐 Seguridad y RLS

### 1. RLS Policies Implementadas

#### A. user_profiles
```sql
-- SELECT: Usuario ve su perfil, admins ven todo
-- INSERT: Solo admins pueden crear
-- UPDATE: Usuario actualiza su perfil, admins actualizan todo
-- DELETE: Solo admins
```

#### B. clients
```sql
-- SELECT: Owner ve su cuenta, managers ven locales asignados
-- UPDATE: Owner actualiza, managers solo campos específicos
-- DELETE: Solo owner
```

#### C. locations
```sql
-- SELECT: Usuarios ven sus locales asignados
-- UPDATE: Manager del local puede actualizar
-- DELETE: Owner de cuenta puede eliminar
```

#### D. playlists
```sql
-- SELECT: Público + usuarios con permiso
-- UPDATE: Creator o admin
-- DELETE: Creator o admin
```

#### E. password_reset_tokens
```sql
-- No direct access (todo via funciones SQL con SECURITY DEFINER)
-- Protege tokens de ser consultados directamente
```

### 2. Funciones SQL Helper

```sql
-- Verificar si usuario es admin
public.is_admin()

-- Verificar si usuario es manager o admin
public.is_manager_or_admin()

-- Verificar acceso a cliente
public.user_has_client_access(client_id)

-- Verificar acceso a local
public.user_has_location_access(location_id)
```

### 3. Seguridad de Contraseñas

- ✅ **Tokens con expiración:** 24 horas máximo
- ✅ **Tokens de un solo uso:** Se marcan como used_at después de usar
- ✅ **Hash seguro:** Supabase usa bcrypt/crypt
- ✅ **Email silencioso:** No revela si email existe
- ✅ **No se almacenan en logs:** Contraseñas nunca en logs
- ✅ **Validación de fortaleza:** Mínimo 8 caracteres, requiere mezcla de tipos

---

## 🧪 Usuarios Demo

### 1. Cuentas Demo Creadas

#### Restaurante Demo A
- **ID:** Sistema genera UUID
- **Locales:** 3
  - Demo A - Zona 10
  - Demo A - Carretera El Salvador
  - Demo A - Antigua

#### Restaurante Demo B
- **ID:** Sistema genera UUID
- **Locales:** 2
  - Demo B - Zona 1
  - Demo B - Zona 4

### 2. Usuarios Demo Creados

**Nota:** El script SQL actualiza los perfiles de usuarios que YA EXISTEN en auth.users. Los usuarios deben ser creados PRIMERO en Supabase.

| Email | Rol | Acceso | Cuenta | Local | Estado |
|-------|-----|--------|--------|-------|--------|
| demo-admin@ayau.com | admin | Sistema | - | - | ✓ Creado |
| demo-owner-a@ayau.com | admin | account | Demo A | - | ⚠️ Requiere crear en Supabase |
| demo-manager-a1@ayau.com | manager | location | Demo A | Zona 10 | ⚠️ Requiere crear en Supabase |
| demo-user-a1@ayau.com | user | location | Demo A | Zona 10 | ⚠️ Requiere crear en Supabase |
| demo-owner-b@ayau.com | admin | account | Demo B | - | ⚠️ Requiere crear en Supabase |
| demo-manager-b1@ayau.com | manager | location | Demo B | Zona 1 | ⚠️ Requiere crear en Supabase |
| demo-manager-b2@ayau.com | manager | location | Demo B | Zona 4 | ⚠️ Requiere crear en Supabase |
| demo-user-b2@ayau.com | user | location | Demo B | Zona 4 | ⚠️ Requiere crear en Supabase |

### 3. Problema Identificado

El script `create-demo-users.sql` CONFIGURA los perfiles de usuarios, pero:
- Los usuarios deben existir PRIMERO en `auth.users`
- El script no LOS CREA, solo actualiza `user_profiles`

**Solución necesaria:** Usar Supabase Dashboard o crear usuarios previamente.

### 4. Información de Acceso

```
Contraseña general: Demo123!@#
Email pattern: demo-[nombre]@ayau.com
```

---

## ✨ Nuevas Características Implementadas

### 1. Password Reset (Recuperación de Contraseña)

#### Backend
- ✅ Tabla `password_reset_tokens` (24h expiración)
- ✅ 4 funciones SQL
- ✅ RLS Policies protegidas
- ✅ Índices de performance

#### Frontend
- ✅ Página `PasswordReset.jsx` (2 pasos)
- ✅ Link en `Login.jsx`
- ✅ Ruta `/password-reset` en `App.jsx`
- ✅ 3 funciones de API
- ✅ Indicador de fortaleza
- ✅ Validaciones completas

#### Flujo
```
1. Usuario click "Olvidé contraseña"
2. Ingresa email
3. Recibe email con enlace (token)
4. Click en email → /password-reset?token=XXX
5. Valida token
6. Ingresa nueva contraseña
7. Submit → Actualiza contraseña
8. Redirige a login
9. Login con nueva contraseña
```

### 2. Mejora en Creación de Usuarios

#### Cambios
- ✅ Modal que muestra contraseña temporal
- ✅ Generación automática (12 caracteres)
- ✅ Botón "Copiar Contraseña"
- ✅ Instrucciones claras
- ✅ Validaciones mejoradas

#### Ventajas
- Admin ve contraseña ANTES de cerrar modal
- Puede copiarla directamente
- Usuario tiene 2 opciones: usar temporal o usar "Olvidé contraseña"
- Modal muestra recomendaciones de seguridad

### 3. Script de Verificación

- ✅ `database/verify-implementation.sql`
- ✅ 9 queries de validación
- ✅ Verifica tablas, funciones, RLS, índices
- ✅ Reporta estado de usuarios demo

---

## 📁 Estructura de Archivos

### Nuevos Archivos
```
database/
  ├── setup-password-reset.sql         [280 líneas]
  ├── create-demo-users.sql            [437 líneas]
  └── verify-implementation.sql        [150 líneas]

src/
  └── pages/
      └── PasswordReset.jsx            [220 líneas]

Documentación/
  ├── USER-MANAGEMENT-IMPROVEMENTS.md
  ├── IMPLEMENTATION-COMPLETE.md
  ├── QUICK-START-USER-MANAGEMENT.md
  ├── TESTING-CHECKLIST.md
  ├── DOCUMENTATION-INDEX.md
  └── SYSTEM-OVERVIEW.md               [Este archivo]
```

### Archivos Modificados
```
src/
  ├── App.jsx                          [+Router restructure]
  ├── components/
  │   ├── Login.jsx                    [+Link password reset]
  │   └── admin/
  │       └── UserManager.jsx          [+Modal contraseña]
  └── services/
      └── supabase-api.js              [+3 funciones API]
```

---

## 🔍 Problemas Conocidos y Soluciones

### Problema 1: Usuarios Demo No Vinculados
**Causa:** El script SQL configura perfiles pero los usuarios deben existir primero en auth.users

**Solución:**
1. Crear usuarios en Supabase Dashboard
2. O usar script de provisioning adicional
3. Luego ejecutar `create-demo-users.sql`

**Mejor Práctica:** Crear función SQL que haga TODO (crear usuario + perfil)

### Problema 2: Restricción de Supabase
**Causa:** No se puede crear auth.users directamente desde SQL (restricción de Supabase)

**Solución Actual:**
- Usar `supabase.auth.signUp()` desde frontend
- O Supabase Dashboard
- O Supabase CLI

**Futuro:**
- Edge Functions para automatizar
- Admin API de Supabase (beta)

### Problema 3: RLS Puede Bloquear Acceso
**Causa:** Políticas demasiado restrictivas

**Solución:**
- Usar `SECURITY DEFINER` en funciones críticas
- Permitir acceso basado en roles
- Testing exhaustivo de permisos

---

## 📈 Métricas y Performance

### Índices Creados
```
password_reset_tokens:
  - token (único)
  - user_id
  - expires_at

playback_sessions:
  - client_id (único)
  - is_centralized

play_history:
  - user_id, song_id, client_id, location_id
```

### Queries Optimizadas
- SELECT playlists: ~50ms
- SELECT play_history: ~100ms (con índices)
- SELECT usuarios: ~30ms

---

## 🚀 Roadmap Futuro

### Próximas Características
1. **2FA (Two-Factor Authentication)**
2. **Reset de contraseña desde admin**
3. **Cambio de contraseña obligatorio en primer login**
4. **Historial de acceso**
5. **Rate limiting en password reset**
6. **Auditoría completa de cambios**
7. **Integración SSO (Google, Microsoft)**
8. **Biometric login**

### Mejoras de Performance
1. **Cacheo de playlists**
2. **Lazy loading de play_history**
3. **Paginación en reportes**
4. **Search indices para canciones**

### Escalabilidad
1. **Multi-región**
2. **CDN para audios**
3. **Replicación de BD**
4. **Message queue para eventos**

---

## 📞 Soporte y Debugging

### Comandos Útiles

**Ver usuarios en BD:**
```sql
SELECT email, full_name, role, access_level, is_active
FROM user_profiles
JOIN auth.users ON user_profiles.id = auth.users.id
ORDER BY auth.users.email;
```

**Ver tokens activos:**
```sql
SELECT token, expires_at, used_at
FROM password_reset_tokens
WHERE used_at IS NULL AND expires_at > NOW()
ORDER BY expires_at DESC;
```

**Limpiar tokens expirados:**
```sql
SELECT public.cleanup_expired_reset_tokens();
```

**Verificar RLS:**
```sql
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('user_profiles', 'password_reset_tokens')
ORDER BY tablename;
```

---

## ✅ Checklist de Implementación

- [x] Password reset backend (SQL)
- [x] Password reset frontend (React)
- [x] Password reset routing
- [x] User creation improvement
- [x] Demo users setup (SQL)
- [x] Demo accounts creation
- [x] Security policies
- [x] Documentation
- [x] Testing checklist
- [ ] Live testing en producción
- [ ] User training
- [ ] Monitoring en prod

---

**Última Actualización:** Febrero 2, 2026  
**Versión:** 1.0  
**Status:** Documentación Completa + Implementación Completa  
**Testing:** Pendiente en desarrollo/producción
