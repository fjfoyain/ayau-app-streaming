# AYAU Music Streaming Platform

Plataforma de streaming de música con tracking preciso de reproducción para cálculo de regalías, panel administrativo completo y sistema de roles multi-nivel.

## 🎯 Stack Tecnológico

- **Frontend**: React 19 + Vite + Material-UI (MUI)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Storage**: Supabase Storage (archivos de audio)
- **Deploy**: Vercel

## 📊 Características Principales

### Sistema de Regalías
- Tracking exacto de segundos reproducidos por canción
- Validación automática de streams (>30 segundos = válido)
- Reportes mensuales, anuales y por país
- Soporte para códigos ISRC, ISWC, IPI

### Panel Administrativo
- **Gestión de Playlists**: Crear, editar, eliminar y asignar canciones
- **Gestión de Canciones**:
  - Upload individual con extracción automática de metadata
  - Carga bulk de múltiples archivos con análisis automático
  - Asignación a múltiples playlists simultáneamente
- **Gestión de Usuarios**: Crear usuarios con diferentes roles y permisos
- **Analytics**: Dashboard con estadísticas de reproducción
- **Diseño moderno**: Interfaz negra con dorado (#F4D03F) - AYAU branding

### Sistema de Roles

#### 1. Admin (Administrador)
- Acceso completo a todas las funciones
- Gestión de usuarios (crear, editar, eliminar)
- Gestión de playlists y canciones
- Acceso a analytics y reportes
- Único rol que puede eliminar playlists

#### 2. Manager (Gestor)
- Gestión de playlists (crear, editar - no eliminar)
- Gestión de canciones (crear, editar, eliminar)
- Acceso a analytics
- **No puede**: Gestionar usuarios ni eliminar playlists

#### 3. User (Usuario Regular)
- Acceso a la aplicación de streaming
- Reproducción de playlists asignadas
- Ver su propio perfil

#### 4. Client User (Usuario Cliente)
- Usuario de cliente/local específico
- Reproducción en modo controlado

### Multi-Tenant
- Clientes → Locales → Usuarios
- Control centralizado de reproducción (broadcasting)
- Modo independiente por local

### Analytics
- Total de segundos reproducidos por canción
- Listeners únicos
- Distribución geográfica
- Reportes por cliente y por local

## 🚀 Setup Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crea un archivo `.env.local` con:

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 3. Configurar Base de Datos

Ejecuta los siguientes scripts en el SQL Editor de Supabase **en este orden**:

1. **`database/supabase-schema-reportes.sql`** - Schema principal de la base de datos
2. **`database/setup-manager-permissions.sql`** - Sistema de roles y permisos RLS
3. **`database/setup-create-user-function.sql`** - Trigger para auto-crear perfiles de usuario
4. **`database/add-email-to-profiles.sql`** - Agregar y sincronizar email en user_profiles
5. **`database/setup-storage.sql`** - Configurar bucket de storage para archivos de audio (si aplica)

Opcionalmente, para diagnosticar problemas:
- **`database/diagnose-and-fix-users.sql`** - Diagnóstico y corrección de usuarios
- **`database/fix-user-profiles-policies.sql`** - Corregir políticas RLS

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

### 5. Crear primer usuario admin

1. Ir a la pestaña de Authentication en Supabase Dashboard
2. Crear un nuevo usuario manualmente
3. En el SQL Editor, ejecutar:

```sql
-- Actualizar el rol del usuario a admin
UPDATE user_profiles
SET role = 'admin'
WHERE id = 'id_del_usuario_creado';
```

### 6. Login

Abre la aplicación en `http://localhost:5173` y usa las credenciales del usuario admin creado.

## 🎵 Características del Reproductor Mejorado

### Visualizador de Espectro
- Visualización en tiempo real del espectro de frecuencias
- Barras de color dinámico (oro a naranja) que responden al audio
- Renderizado optimizado con Device Pixel Ratio
- Responsive y adapta a cambios de ventana

### Resume Playback (Reanudar Reproducción)
- Guarda automáticamente la posición de reproducción en `localStorage`
- Al cargar la misma canción, continúa desde donde se pausó
- Restaura posición después de 5 segundos reproducidos (evita ads)
- Clave: `resume_<songId>`

### Signed URLs con Auto-Renovación
- Genera URLs firmadas temporales para Storage privado (TTL: 1 hora)
- Caché en memoria para evitar regeneración innecesaria
- Auto-renovación cada 50 minutos durante reproducción
- Fallback a URLs públicas si bucket es público

### Prefetch de Siguiente Canción
- Pre-genera signed URL de la siguiente canción en la playlist
- Reduce latencia al cambiar de canción
- Carga metadata automáticamente

### Cover Image Preload
- Precarga imagen de portada antes de mostrar
- Evita titileo/parpadeo al cambiar canción
- Transición suave con opacity fade

## 📁 Estructura del Proyecto

```
ayau-app/
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.jsx    # Dashboard principal
│   │   │   ├── AdminLayout.jsx       # Layout con sidebar
│   │   │   ├── AnalyticsDashboard.jsx
│   │   │   ├── PlaylistManager.jsx   # Gestión de playlists
│   │   │   ├── ProtectedAdminRoute.jsx
│   │   │   ├── SongManager.jsx       # Gestión de canciones + bulk upload
│   │   │   └── UserManager.jsx       # Gestión de usuarios
│   │   ├── Login.jsx                 # Página de login
│   │   ├── MusicPlayer.jsx           # Reproductor con visualizador
│   │   └── PlaylistSidebar.jsx       # Sidebar con playlists
│   ├── context/
│   │   └── PlayerContext.jsx         # Estado global + prefetch + resume
│   ├── lib/
│   │   └── supabase.js               # Cliente de Supabase
│   ├── pages/
│   │   └── HomePage.jsx              # Página principal
│   ├── services/
│   │   └── supabase-api.js           # API + getSignedUrl helper
│   ├── App.jsx                       # Rutas y App principal
│   └── main.jsx                      # Entry point
├── database/
│   ├── supabase-schema-reportes.sql  # Schema principal
│   ├── setup-manager-permissions.sql # Sistema de roles
│   ├── setup-create-user-function.sql
│   ├── add-email-to-profiles.sql
│   ├── setup-storage.sql
│   ├── diagnose-and-fix-users.sql    # Troubleshooting
│   ├── fix-user-profiles-policies.sql
│   └── archive/                       # Scripts antiguos/debug
├── PLAN-IMPLEMENTACION.md
├── TRACKING-REPRODUCCION.md
├── DATABASE-SETUP.md                 # Guía detallada de setup de BD
└── package.json
```

## 🔐 Seguridad y RLS (Row Level Security)

El sistema utiliza políticas RLS de PostgreSQL para asegurar el acceso a los datos:

- **user_profiles**: Los admins ven todos los usuarios, otros solo su perfil
- **playlists**: Los usuarios ven solo sus playlists asignadas vía RLS automático
- **songs**: Acceso según playlists asignadas
- **play_history**: Los usuarios solo ven su propio historial

### Funciones de Seguridad

```sql
-- Verifica si el usuario actual es admin
public.is_admin()

-- Verifica si el usuario actual es admin o manager
public.is_manager_or_admin()
```

Estas funciones usan `SECURITY DEFINER` para evitar recursión infinita en las políticas RLS.

## 🎵 Funcionalidades Clave

### Carga Bulk de Canciones

1. Ir a Admin Panel → Canciones
2. Click en "Carga Bulk"
3. Seleccionar múltiples archivos MP3
4. El sistema automáticamente:
   - Extrae metadata de cada archivo (título, artista, duración, ISRC)
   - Crea la canción en la base de datos
   - Sube el archivo de audio a Supabase Storage
   - Muestra progreso en tiempo real

### Gestión de Usuarios

Los administradores pueden:
- Crear nuevos usuarios con email, nombre completo, contraseña y rol
- Editar roles de usuarios existentes
- Asignar permisos a playlists específicas (próximamente)

### Tracking de Reproducción

- El sistema registra automáticamente cada reproducción
- Cuenta segundos exactos reproducidos
- Identifica país del usuario
- Calcula regalías por artista y canción

## 📋 Roadmap

- [x] Fase 1: Setup de Supabase
- [x] Fase 2: Configuración local
- [x] Fase 3: Admin Panel
  - [x] Gestión de playlists
  - [x] Gestión de canciones
  - [x] Carga bulk de archivos
  - [x] Gestión de usuarios
  - [x] Sistema de roles (admin/manager)
  - [x] Analytics básico
- [x] Fase 4: Frontend (Auth + Tracking)
- [ ] Fase 5: Testing completo
- [ ] Fase 6: Deploy a Vercel
- [ ] Fase 7: Mejoras futuras
  - [ ] Reportes avanzados de regalías
  - [ ] Export a CSV de analytics
  - [ ] Sistema de clientes y locales
  - [ ] Broadcasting centralizado

## 📚 Documentación Adicional

### 🔴 Documentación Principal (Recomendado Leer)

- **[DOCUMENTATION-SUMMARY.md](DOCUMENTATION-SUMMARY.md)** - Resumen de toda la documentación (3,600+ líneas)
- **[GETTING-STARTED-DOCS.md](GETTING-STARTED-DOCS.md)** - Guía de navegación personalizada por rol
- **[EXECUTIVE-SUMMARY.md](EXECUTIVE-SUMMARY.md)** - Resumen ejecutivo de implementación

### 🟡 Documentación Técnica (Especificaciones)

- **[SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)** - Arquitectura completa del sistema (751 líneas)
- **[PLAYBACK-SYNC-SPECIFICATION.md](PLAYBACK-SYNC-SPECIFICATION.md)** - Sistema de sincronización de playback (669 líneas)
- **[ARCHITECTURE-VISUAL.md](ARCHITECTURE-VISUAL.md)** - Diagramas y flujos visuales (685 líneas)

### 🟢 Documentación de Implementación (Referencia)

- **[DEMO-USERS-INVESTIGATION.md](DEMO-USERS-INVESTIGATION.md)** - Investigación sobre usuarios demo (450 líneas)
- **[IMPLEMENTATION-COMPLETE.md](IMPLEMENTATION-COMPLETE.md)** - Cambios implementados
- **[QUICK-START-USER-MANAGEMENT.md](QUICK-START-USER-MANAGEMENT.md)** - Guía rápida de gestión de usuarios
- **[USER-MANAGEMENT-IMPROVEMENTS.md](USER-MANAGEMENT-IMPROVEMENTS.md)** - Plan original de mejoras
- **[TESTING-CHECKLIST.md](TESTING-CHECKLIST.md)** - 40+ casos de prueba

### 📁 Documentación Existente

- [Plan de Implementación](PLAN-IMPLEMENTACION.md)
- [Tracking de Reproducción](TRACKING-REPRODUCCION.md)
- [Guía de Setup de Base de Datos](DATABASE-SETUP.md)
- [Índice de Documentación](DOCUMENTATION-INDEX.md)

## 🛠️ Scripts Disponibles

```bash
npm run dev      # Ejecutar en desarrollo
npm run build    # Build para producción
npm run preview  # Preview del build
```

## 💰 Costos Estimados

- Supabase: $0/mes (Free tier - hasta 500MB storage, 2GB bandwidth)
- Vercel: $0/mes (Free tier)

**Total**: $0/mes para desarrollo y testing inicial

Para producción con más usuarios:
- Supabase Pro: $25/mes (8GB storage, 100GB bandwidth)

## 🎨 Diseño y Branding

- **Color principal**: Negro (#000)
- **Color acento**: Dorado AYAU (#F4D03F)
- **Tipografía**: Roboto (Material-UI)
- **Iconografía**: Material Icons
- **Tema**: Dark mode con acentos dorados

## 🐛 Troubleshooting

### No puedo ver usuarios en el panel admin
Ejecutar `diagnose-and-fix-users.sql` para sincronizar usuarios y verificar políticas RLS.

### Error al subir archivos de audio
Verificar que el bucket de storage esté configurado correctamente con `setup-storage.sql`.

### Usuario no tiene permisos
Verificar el rol del usuario en la tabla `user_profiles`. Solo admins y managers pueden acceder al panel admin.

## 📞 Contacto y Soporte

Para reportar bugs o solicitar features, contacta al equipo de desarrollo de AYAU.

---

Desarrollado por AYAU 🎵 - MÚSICA, ON FIRE
