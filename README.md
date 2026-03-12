# AYAU Music Streaming Platform

Plataforma de streaming de música multi-tenant con tracking preciso de reproducción para cálculo de regalías, sincronización en tiempo real entre locales (Modo DJ), panel administrativo completo y sistema de roles multi-nivel.

> **MÚSICA, ON FIRE**

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite 6 + React Router 6 |
| UI | Material-UI (MUI) 7 + Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Edge Functions | Deno / TypeScript (Supabase Functions) |
| Audio | HTML5 Audio API + Web Audio API |
| Charts | Recharts |
| Deploy | Vercel |

---

## Características Principales

### Reproductor de Música
- Controles de reproducción (play/pause, anterior/siguiente, seek, volumen)
- **Visualizador de espectro** en tiempo real — 20 barras de frecuencia, 60fps via Web Audio API
- **Resume Playback**: guarda posición en `localStorage`, reanuda desde donde se pausó
- **Gapless Playback**: transición al siguiente track 2 segundos antes del fin
- **Signed URLs con auto-renovación**: URLs privadas de Supabase Storage (TTL 1 hora, renueva a los 50 min)
- **Prefetch de siguiente canción**: pre-genera URL y pre-carga audio 10 segundos antes de que sea necesario
- **Cover Image Preload**: precarga imagen de portada, evita parpadeo al cambiar canción
- Atajo de teclado: `Espacio` para play/pause

### Sistema de Regalías
- Tracking exacto de segundos reproducidos por canción
- Validación automática de streams (`stream_duration > 30s` = stream válido)
- Soporte para códigos de identificación: **ISRC**, **ISWC**, **IPI**
- Reportes mensuales, anuales y por país
- Tabla `stream_analytics_monthly` pre-agregada para reportes rápidos
- Distribución geográfica por `country_code`

### Arquitectura Multi-Tenant
- Jerarquía: **Clientes (Empresas)** → **Locales (Venues)** → **Usuarios**
- Tres modos de reproducción por cliente:
  1. **Independiente**: cada local controla su música por separado
  2. **Playlist Compartida**: comparten catálogo pero controlan independiente
  3. **Sincronizado (Modo DJ)**: un DJ/Manager controla todos los locales en tiempo real

### Modo DJ (Reproducción Sincronizada)
- Sincronización en tiempo real vía **Supabase Realtime** (WebSockets)
- Un controlador (DJ) controla play/pause/seek/canción en todos los locales simultáneamente
- Latencia de sincronización: ~100–500ms
- Números de secuencia para prevenir actualizaciones fuera de orden
- Panel `DJModePanel` con indicador de conexión y botón Tomar/Liberar control
- `SyncStatusIndicator` muestra estado de sincronización a todos los usuarios

### Panel Administrativo (Rutas Protegidas)
- **Dashboard**: estadísticas globales (playlists, canciones, usuarios, reproducciones)
- **Gestión de Canciones**: upload individual o bulk con extracción automática de metadata ID3 (título, artista, duración, ISRC, cover art)
- **Gestión de Playlists**: crear, editar, asignar canciones y portadas
- **Gestión de Usuarios**: invitar usuarios por email, asignar roles y niveles de acceso, reenviar invitaciones
- **Gestión de Cuentas**: administrar empresas/clientes, configurar modo de reproducción
- **Gestión de Locales**: administrar venues por cliente, asignar managers
- **Analytics**: dashboard con historial de reproducciones, top canciones, filtros por fecha/cuenta/local

### Sistema de Roles (RBAC)

| Rol | Alcance | Playlists | Canciones | Usuarios | Cuentas/Locales |
|-----|---------|-----------|-----------|----------|-----------------|
| **Admin** | Sistema completo | CRUD + eliminar | CRUD | CRUD | CRUD |
| **Manager** | Cuenta/Local | Crear + editar | Crear + editar | Solo ver | Solo ver |
| **User** | Local asignado | Solo reproducir | Solo escuchar | — | — |

### Seguridad
- **Row-Level Security (RLS)** en todas las tablas de PostgreSQL
- JWT via Supabase Auth — clave anónima en frontend (nunca service role)
- Signed URLs temporales para archivos de audio (sin acceso directo al storage)
- Edge Functions validan rol del caller antes de ejecutar
- Funciones SQL `is_admin()` / `is_manager_or_admin()` con `SECURITY DEFINER`
- Reset de contraseña con tokens de un solo uso (TTL 24 horas)
- Headers de seguridad en Vercel: CSP, X-Frame-Options, nosniff, Referrer-Policy

---

## Setup Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase (Dashboard → Project Settings → API):

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 3. Configurar Base de Datos

Ejecuta los scripts en el SQL Editor de Supabase **en este orden**:

1. `database/supabase-schema-reportes.sql` — Schema principal
2. `database/setup-manager-permissions.sql` — Roles y políticas RLS
3. `database/setup-create-user-function.sql` — Trigger auto-creación de perfiles
4. `database/add-email-to-profiles.sql` — Sincronización de email en user_profiles
5. `database/setup-storage.sql` — Buckets de storage (songs, covers)
6. `database/migrate-account-venue-management.sql` — Gestión de cuentas y locales
7. `database/add-playback-mode.sql` — Configuración de modo de reproducción

Scripts opcionales para troubleshooting:
- `database/diagnose-and-fix-users.sql`
- `database/fix-user-profiles-policies.sql`

### 4. Ejecutar en desarrollo

```bash
npm run dev
# App en http://localhost:5173
```

### 5. Crear primer usuario admin

1. Ve a Supabase Dashboard → Authentication → Users
2. Crea un usuario manualmente
3. Ejecuta en el SQL Editor:

```sql
UPDATE user_profiles
SET role = 'admin'
WHERE id = 'id-del-usuario';
```

4. Abre `http://localhost:5173` y haz login

---

## Estructura del Proyecto

```
ayau-app-streaming/
├── src/
│   ├── App.jsx                       # Router principal + auth state
│   ├── main.jsx                      # Entry point
│   ├── index.css                     # Estilos globales
│   │
│   ├── pages/
│   │   ├── HomePage.jsx              # Interfaz principal de streaming
│   │   └── PasswordReset.jsx         # Recuperación de contraseña (2 pasos)
│   │
│   ├── components/
│   │   ├── MusicPlayer.jsx           # Reproductor + visualizador de espectro
│   │   ├── DJModePanel.jsx           # Panel de control DJ (modo sincronizado)
│   │   ├── SyncStatusIndicator.jsx   # Indicador de estado de sincronización
│   │   ├── PlaylistSidebar.jsx       # Sidebar con lista de playlists
│   │   ├── Login.jsx                 # Formulario de autenticación
│   │   ├── Loading.jsx               # Componente de carga
│   │   ├── ErrorBoundary.jsx         # Error boundary de React
│   │   ├── ForcePasswordChangeModal.jsx
│   │   │
│   │   └── admin/                    # Rutas admin protegidas
│   │       ├── AdminLayout.jsx       # Layout con sidebar de navegación
│   │       ├── AdminDashboard.jsx    # Estadísticas globales
│   │       ├── AccountManager.jsx    # Gestión de empresas/clientes
│   │       ├── VenueManager.jsx      # Gestión de locales/venues
│   │       ├── PlaylistManager.jsx   # Gestión de playlists
│   │       ├── SongManager.jsx       # Gestión de canciones + bulk upload
│   │       ├── UserManager.jsx       # Gestión de usuarios (solo admin)
│   │       ├── AnalyticsDashboard.jsx # Analytics y reportes
│   │       └── ProtectedAdminRoute.jsx # Guard de rutas admin
│   │
│   ├── context/
│   │   ├── PlayerContext.jsx         # Estado global de reproducción + prefetch
│   │   └── SyncPlaybackContext.jsx   # Estado de sincronización DJ Mode
│   │
│   ├── services/
│   │   └── supabase-api.js           # Capa de API completa (Supabase)
│   │
│   ├── lib/
│   │   └── supabase.js               # Inicialización del cliente Supabase
│   │
│   └── utils/
│       ├── musicPlayer.js            # Helpers (formatTime, formatDuration)
│       └── logger.js                 # Utilidades de logging
│
├── supabase/
│   └── functions/
│       └── invite-user/
│           └── index.ts              # Edge Function: invite / resend / delete
│
├── database/                         # Scripts SQL de schema y migraciones
│   ├── supabase-schema-reportes.sql  # Schema principal
│   ├── setup-manager-permissions.sql # Sistema de roles RLS
│   ├── setup-storage.sql             # Configuración de buckets
│   ├── migrate-account-venue-management.sql
│   ├── add-playback-mode.sql
│   └── archive/                      # Scripts históricos / debug
│
├── docs/
│   ├── technical/                    # Documentación técnica
│   │   ├── SYSTEM-OVERVIEW.md
│   │   ├── PLAYBACK-SYNC-SPECIFICATION.md
│   │   ├── ARCHITECTURE-VISUAL.md
│   │   └── DATABASE-SETUP.md
│   └── guides/                       # Guías de uso y despliegue
│       ├── DEPLOYMENT-GUIDE.md
│       ├── GETTING-STARTED-DOCS.md
│       ├── QUICK-START-USER-MANAGEMENT.md
│       ├── TESTING-CHECKLIST.md
│       └── QUICK-REFERENCE.md
│
├── ARCHITECTURE.md                   # Arquitectura técnica completa
├── PROJECT-VALUATION.md              # Valoración del proyecto
├── ROADMAP.md                        # Plan de mejoras y deuda técnica
├── vercel.json                       # Configuración de despliegue + headers
├── vite.config.js                    # Build + test config
└── package.json
```

---

## Rutas de la Aplicación

```
/                    →  HomePage (streaming para usuarios)
/password-reset      →  PasswordReset (recuperación de contraseña)
/admin               →  AdminDashboard (protegido: admin/manager)
/admin/playlists     →  PlaylistManager
/admin/songs         →  SongManager
/admin/users         →  UserManager (solo admin)
/admin/accounts      →  AccountManager
/admin/venues        →  VenueManager
/admin/analytics     →  AnalyticsDashboard
```

---

## Scripts Disponibles

```bash
npm run dev          # Servidor de desarrollo (http://localhost:5173)
npm run build        # Build de producción → dist/
npm run preview      # Preview del build de producción
npm run lint         # Revisión con ESLint
npm run test         # Tests en modo watch (Vitest)
npm run test:run     # Ejecución única de tests
npm run test:coverage # Reporte de cobertura
```

---

## Despliegue (Producción)

El frontend se despliega automáticamente en **Vercel** al hacer push a `main`.

Variables de entorno requeridas en Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Ver [docs/guides/DEPLOYMENT-GUIDE.md](docs/guides/DEPLOYMENT-GUIDE.md) para guía completa.

---

## Costos Estimados

| Servicio | Plan Gratuito | Plan Producción |
|----------|--------------|-----------------|
| Supabase | $0/mes (500MB storage, 2GB bandwidth) | $25/mes (8GB, 100GB) |
| Vercel | $0/mes | $20/mes (Pro) |

---

## Diseño y Branding

- **Color principal**: Negro (`#000`)
- **Color acento**: Dorado AYAU (`#F4D03F`)
- **Tipografía**: Roboto (Material-UI)
- **Iconografía**: Material Icons + Lucide React
- **Tema**: Dark mode con acentos dorados

---

## Troubleshooting

**No aparecen usuarios en el panel admin**
Ejecuta `database/diagnose-and-fix-users.sql` para sincronizar perfiles y verificar políticas RLS.

**Error al subir archivos de audio**
Verifica que los buckets estén configurados con `database/setup-storage.sql`.

**Usuario sin permisos al panel admin**
Verifica el campo `role` en la tabla `user_profiles`. Solo `admin` y `manager` pueden acceder.

**Modo DJ no sincroniza**
Verifica que el cliente tenga `playback_mode = 'synchronized'` y que exista una sesión activa en `playback_sessions`.

---

## Documentación Adicional

- [ARCHITECTURE.md](ARCHITECTURE.md) — Arquitectura técnica completa del sistema
- [PROJECT-VALUATION.md](PROJECT-VALUATION.md) — Valoración del proyecto
- [ROADMAP.md](ROADMAP.md) — Plan de mejoras y próximos pasos
- [docs/technical/SYSTEM-OVERVIEW.md](docs/technical/SYSTEM-OVERVIEW.md) — Visión general del sistema
- [docs/technical/PLAYBACK-SYNC-SPECIFICATION.md](docs/technical/PLAYBACK-SYNC-SPECIFICATION.md) — Especificación del sistema de sincronización
- [docs/guides/DEPLOYMENT-GUIDE.md](docs/guides/DEPLOYMENT-GUIDE.md) — Guía de despliegue a producción
- [docs/guides/TESTING-CHECKLIST.md](docs/guides/TESTING-CHECKLIST.md) — 40+ casos de prueba

---

Desarrollado por AYAU — MÚSICA, ON FIRE
