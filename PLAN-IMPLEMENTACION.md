# 🎯 Plan de Implementación - AYAU Music Streaming
## Stack Nuevo (Sin Migración de Datos)

**Decisión**: Empezar desde cero con canciones nuevas y confiables

---

## 📊 Arquitectura Final

```
┌─────────────────┐
│  React + Vite   │  ← Frontend (cambios mínimos)
│  Material UI    │
└────────┬────────┘
         │
    ┌────▼─────┐
    │  Vercel  │  ← Hosting
    └────┬─────┘
         │
    ┌────▼──────────────────────────┐
    │         Supabase              │
    │  ┌──────────┐  ┌───────────┐ │
    │  │PostgreSQL│  │Auth       │ │
    │  │+ Schema  │  │(email/pwd)│ │
    │  └──────────┘  └───────────┘ │
    └───────────────────────────────┘
         │
    ┌────▼─────────┐
    │ Cloudflare R2│  ← Nuevas 800 canciones
    │ (audio files)│
    └──────────────┘
```

---

## 🚀 Fases de Implementación

### **Fase 1: Setup de Infraestructura** (2-3 horas)

#### 1.1 Supabase Setup
- [x] Crear cuenta Supabase
- [ ] Crear proyecto `ayau-music-streaming`
- [ ] Ejecutar `supabase-schema-complete.sql` en SQL Editor
- [ ] Obtener credenciales (URL + anon key)
- [ ] Configurar Supabase Auth (email/password)
- [ ] Crear primer usuario admin

#### 1.2 Cloudflare R2 Setup
- [ ] Crear cuenta Cloudflare
- [ ] Crear bucket `ayau-music`
- [ ] Configurar CORS para acceso público
- [ ] Obtener credenciales (Access Key + Secret Key)
- [ ] (Opcional) Configurar dominio personalizado

#### 1.3 Vercel Setup
- [ ] Crear cuenta Vercel
- [ ] Conectar repositorio GitHub (opcional por ahora)

**Duración**: 2-3 horas

---

### **Fase 2: Configuración Local** (1-2 horas)

#### 2.1 Instalar Dependencias

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-react
npm install react-dropzone music-metadata  # Para admin panel
```

#### 2.2 Configurar Variables de Entorno

Crear `.env.local`:
```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Cloudflare R2 (solo para admin panel)
VITE_R2_ACCOUNT_ID=tu-account-id
VITE_R2_ACCESS_KEY=tu-access-key
VITE_R2_SECRET_KEY=tu-secret-key
VITE_R2_BUCKET=ayau-music
VITE_R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

#### 2.3 Crear Cliente Supabase

`src/lib/supabase.js`:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Duración**: 1-2 horas

---

### **Fase 3: Admin Panel** (12-16 horas)

#### 3.1 Estructura de Rutas

```
src/
├── pages/
│   ├── Home.jsx           # App actual (playlists + player)
│   ├── Admin/
│   │   ├── Dashboard.jsx  # Panel principal admin
│   │   ├── Songs.jsx      # Gestión de canciones
│   │   ├── Playlists.jsx  # Gestión de playlists
│   │   └── Upload.jsx     # Subir canciones
└── App.jsx                # Router
```

#### 3.2 Componente de Upload con Drag & Drop

**Funcionalidades**:
- ✅ Drag & drop de archivos MP3/WAV/FLAC
- ✅ Extracción automática de metadata (ID3 tags)
- ✅ Upload a R2
- ✅ Guardado en Supabase
- ✅ Preview de artwork
- ✅ Edición manual de campos (ISRC, ISWC, IPI, Code)
- ✅ Bulk upload (múltiples archivos)

#### 3.3 Gestión de Playlists

**Funcionalidades**:
- ✅ Crear/editar/eliminar playlists
- ✅ Drag & drop para reordenar canciones
- ✅ Búsqueda de canciones para agregar
- ✅ Upload de cover image para playlist

#### 3.4 Importación desde CSV

**Para completar metadata faltante**:
- Upload CSV con: title, author, performer, isrc, iswc, ipi, code
- Match por título
- Actualizar registros en Supabase

**Duración**: 12-16 horas

---

### **Fase 4: Actualizar Frontend** (4-6 horas)

#### 4.1 Crear Servicio de API

`src/services/supabase-api.js`:
```javascript
import { supabase } from '../lib/supabase'

// Obtener todas las playlists del usuario
export const getUserPlaylists = async (userId) => {
  const { data, error } = await supabase
    .from('playlists')
    .select(`
      *,
      playlist_permissions!inner(user_id)
    `)
    .eq('playlist_permissions.user_id', userId)

  if (error) throw error
  return data
}

// Obtener canciones de una playlist (con URLs firmadas)
export const getPlaylistSongs = async (playlistId) => {
  const { data, error } = await supabase
    .from('playlist_songs')
    .select(`
      id,
      position,
      songs (*)
    `)
    .eq('playlist_id', playlistId)
    .order('position')

  if (error) throw error

  // Transformar para el player
  return data.map(item => ({
    id: item.songs.id,
    title: item.songs.title,
    performer: item.songs.performer,
    duration: item.songs.duration,
    url: item.songs.file_url  // R2 public URL
  }))
}

// Registrar reproducción (analytics)
export const recordPlay = async (userId, songId, playlistId, duration) => {
  const { error } = await supabase
    .from('play_history')
    .insert({
      user_id: userId,
      song_id: songId,
      playlist_id: playlistId,
      stream_duration: duration
    })

  if (error) console.error('Error recording play:', error)
}
```

#### 4.2 Actualizar Autenticación

**Reemplazar OIDC con Supabase Auth**:

`src/components/Login.jsx`:
```javascript
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) alert(error.message)
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  )
}
```

#### 4.3 Actualizar App.jsx

**Cambios principales**:
- Reemplazar `useAuth()` de OIDC con `supabase.auth.getSession()`
- Usar `getUserPlaylists()` en vez de axios
- Agregar listener de auth state

#### 4.4 Actualizar PlaylistSidebar.jsx

- Reemplazar axios con `getPlaylistSongs()`
- Agregar `recordPlay()` cuando se reproduce una canción

**Duración**: 4-6 horas

---

### **Fase 5: Testing** (4-6 horas)

#### 5.1 Testing Local
- [ ] Login/logout funciona
- [ ] Ver playlists del usuario
- [ ] Ver canciones de una playlist
- [ ] Reproducir audio desde R2
- [ ] Admin panel: upload de canciones
- [ ] Admin panel: crear playlists
- [ ] Admin panel: asignar canciones a playlists
- [ ] Analytics: verificar play_history se registra

#### 5.2 Testing de Permisos (RLS)
- [ ] Usuario normal solo ve sus playlists
- [ ] Usuario normal NO puede crear playlists
- [ ] Admin puede ver todas las playlists
- [ ] Admin puede crear/editar/eliminar playlists y canciones

#### 5.3 Testing de Performance
- [ ] Playlists cargan rápido (< 1s)
- [ ] Audio inicia reproducción rápido (< 2s)
- [ ] Múltiples canciones se pueden reproducir seguidas

**Duración**: 4-6 horas

---

### **Fase 6: Deployment** (2-4 horas)

#### 6.1 Preparar para Producción

```bash
# Build de producción
npm run build

# Test del build localmente
npm run preview
```

#### 6.2 Deploy a Vercel

1. Push a GitHub
2. Conectar repo en Vercel
3. Configurar variables de entorno en Vercel
4. Deploy automático

#### 6.3 Configurar Dominios (Opcional)

- `ayauplay.com` → App principal (Vercel)
- `admin.ayauplay.com` → Admin panel (Vercel con ruta /admin)

#### 6.4 Post-Deployment

- [ ] Verificar en producción
- [ ] Crear usuario admin en producción
- [ ] Subir canciones iniciales
- [ ] Configurar analytics

**Duración**: 2-4 horas

---

## 📋 Checklist Completo

### Infraestructura
- [ ] Proyecto Supabase creado
- [ ] Schema SQL ejecutado
- [ ] Bucket R2 creado y configurado
- [ ] Variables de entorno configuradas

### Código
- [ ] Dependencias instaladas
- [ ] Cliente Supabase creado
- [ ] Servicio API implementado
- [ ] Admin panel completo
- [ ] Frontend actualizado (Auth + API calls)

### Testing
- [ ] Testing local completo
- [ ] Testing de permisos (RLS)
- [ ] Testing de performance

### Deployment
- [ ] Build de producción funcionando
- [ ] Deploy a Vercel exitoso
- [ ] Usuario admin creado en producción
- [ ] Canciones iniciales subidas

---

## 💰 Costos Mensuales

| Servicio | Costo |
|----------|-------|
| Supabase Free Tier | $0 |
| Cloudflare R2 (800 canciones ~4GB) | $0.60 storage + $0.50 requests = **$1-2** |
| Vercel Free Tier | $0 |
| **TOTAL** | **~$2/mes** |

**Ahorro vs AWS**: $50-200/mes → $2/mes = **98% ahorro** 🎉

---

## 🎯 Siguiente Paso: Fase 1

Vamos a empezar con Supabase. Por favor:

### 1. Crear Proyecto Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Crea cuenta
3. Click "New Project"
4. Configuración:
   - **Name**: `ayau-music-streaming`
   - **Password**: (genera una fuerte)
   - **Region**: `US East (North Virginia)`
   - **Plan**: Free

### 2. Ejecutar Schema
1. Una vez creado, ve a **SQL Editor**
2. Click "New query"
3. Copia el contenido de `supabase-schema-complete.sql`
4. Ejecuta (Run)

### 3. Compartir Credenciales
Cuando termines, compárteme:
- Project URL
- anon public key

**¿Listo para empezar? 🚀**
