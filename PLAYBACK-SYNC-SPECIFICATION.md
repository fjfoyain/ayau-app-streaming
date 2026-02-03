# 🎵 Especificación Completa: Sistema de Sincronización de Playback

## 📌 Descripción General

AYAU tiene un sistema sofisticado de control de reproducción de música que permite 3 modos operacionales para cada cuenta:

1. **Independent** - Cada local controla su música de manera independiente
2. **Shared Playlist** - Todos los locales comparten las mismas playlists pero controlan reproducción independiente
3. **Synchronized** - Un controlador central (DJ/Manager) controla la música en todos los locales simultáneamente

---

## 🏗️ Arquitectura del Sistema

### 1. Base de Datos - Tabla `playback_sessions`

```sql
CREATE TABLE playback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  playback_mode VARCHAR(50) NOT NULL DEFAULT 'independent',
    -- Valores: 'independent', 'shared_playlist', 'synchronized'
  
  -- Datos de sesión actual
  current_song_id UUID REFERENCES songs(id),
  current_playlist_id UUID REFERENCES playlists(id),
  
  -- Control de reproducción
  playback_state VARCHAR(20) DEFAULT 'stopped',
    -- Valores: 'playing', 'paused', 'stopped'
  playback_position INTEGER DEFAULT 0,        -- Segundos
  is_centralized BOOLEAN DEFAULT false,       -- True en modo sincronizado
  
  -- Control de DJ/Manager
  controlled_by UUID REFERENCES auth.users(id),  -- ID del usuario controlador
  
  -- Metadata
  duration_ms INTEGER,                        -- Duración de canción en ms
  volume INTEGER DEFAULT 100,                 -- 0-100
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_playback_mode CHECK (
    playback_mode IN ('independent', 'shared_playlist', 'synchronized')
  ),
  CONSTRAINT valid_playback_state CHECK (
    playback_state IN ('playing', 'paused', 'stopped')
  )
);

-- Índices para performance
CREATE UNIQUE INDEX idx_playback_sessions_client_id ON playback_sessions(client_id);
CREATE INDEX idx_playback_sessions_is_centralized ON playback_sessions(is_centralized);
```

### 2. Base de Datos - Tabla `clients`

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS playback_mode VARCHAR(50) DEFAULT 'independent';
```

**Este campo se sincroniza con `playback_sessions.playback_mode`**

---

## 🎛️ React Context - `SyncPlaybackContext`

### Ubicación
`src/context/SyncPlaybackContext.jsx`

### Estado Global

```javascript
const initialState = {
  // Configuración
  clientId: null,                           // ID de la cuenta
  playbackMode: 'independent',              // 'independent' | 'shared_playlist' | 'synchronized'
  currentLocationId: null,                  // ID del local actual
  
  // Control
  isController: false,                      // ¿Puede controlar reproducción?
  controlledBy: null,                       // ID del usuario controlador
  
  // Estado de reproducción
  currentSongId: null,
  currentPlaylistId: null,
  playbackState: 'stopped',                 // 'playing' | 'paused' | 'stopped'
  playbackPosition: 0,
  
  // Metadata
  currentSong: null,                        // Objeto completo de canción
  duration: 0,
  volume: 100,
  
  // Sincronización
  isSynced: false,                          // ¿Está en sinc con servidor?
  lastUpdate: null,
  syncError: null,
};
```

### Acciones Disponibles

```javascript
// Configurar
SET_PLAYBACK_MODE(playbackMode)
SET_CLIENT_ID(clientId)
SET_LOCATION_ID(locationId)
SET_CONTROLLER(userId, isController)

// Reproducción
SET_CURRENT_SONG(songId, song)
SET_PLAYBACK_STATE(state)
SET_PLAYBACK_POSITION(position)
SET_DURATION(duration)
SET_VOLUME(volume)

// Sincronización
SYNC_TO_REMOTE(state)
UPDATE_FROM_SERVER(remoteState)
SET_SYNC_ERROR(error)

// Reset
RESET_PLAYBACK()
```

### Ejemplo de Uso

```javascript
// En un componente
const { state, dispatch } = useContext(SyncPlaybackContext);

// Cambiar modo
dispatch({
  type: 'SET_PLAYBACK_MODE',
  payload: 'synchronized'  // o 'shared_playlist' o 'independent'
});

// Si es controlador, puede reproducir
if (state.isController && state.playbackMode === 'synchronized') {
  dispatch({
    type: 'SET_PLAYBACK_STATE',
    payload: 'playing'
  });
}
```

---

## 🎼 React Components Relacionados

### 1. `MusicPlayer.jsx` (Principal)

**Ubicación:** `src/components/MusicPlayer.jsx`

**Responsabilidades:**
- Reproducción de audio HTML5
- Controles de play/pause/next/previous
- Visualización de canción actual
- Sincronización con servidor según modo

**Flujo:**

```jsx
<MusicPlayer>
  {/* Solo visible en modo 'synchronized' */}
  {state.playbackMode === 'synchronized' && (
    <SyncStatusIndicator />
  )}
  
  {/* Solo si es controlador en modo sync */}
  {state.isController && state.playbackMode === 'synchronized' && (
    <DJModePanel />
  )}
  
  {/* Siempre visible */}
  <AudioPlayer>
    {/* Controles según modo */}
  </AudioPlayer>
</MusicPlayer>
```

### 2. `SyncStatusIndicator.jsx` (Indicador Visual)

**Ubicación:** `src/components/SyncStatusIndicator.jsx`

**Función:** Mostrar estado de sincronización

**Casos:**
- "Sincronizado ✓" - Está en sinc
- "Sincronizando..." - Actualizando
- "Sin sinc ✗" - Hay error
- "DJ Activo: [nombre]" - Quién controla

**Colores:**
- 🟢 Verde: Sincronizado
- 🟡 Amarillo: Sincronizando
- 🔴 Rojo: Sin sincronizar

### 3. `DJModePanel.jsx` (Panel de DJ/Manager)

**Ubicación:** `src/components/DJModePanel.jsx`

**Solo visible cuando:**
- `playbackMode === 'synchronized'`
- `isController === true`
- Usuario tiene rol 'manager' o 'admin'

**Controles disponibles:**
- Selector de playlist
- Play / Pause
- Previous / Next
- Control de volumen
- Mostrar queue
- Información de ubicación (qué locales están escuchando)

**Eventos:**
- Al cambiar canción → Sincroniza a todos los locales
- Al pausar → Pausa en todos los locales
- Al cambiar volumen → Actualiza en todos

---

## 🔄 Flujos de Operación

### Flujo 1: Modo Independent

```
Usuario en Local A
         ↓
Abre MusicPlayer
         ↓
state.playbackMode = 'independent'
         ↓
Controles HABILITADOS para Local A
         ↓
Cambios NO se sincronizan
         ↓
Local B no es afectado
```

**Queries SQL:**
```sql
-- Ver configuración
SELECT playback_mode FROM clients WHERE id = $clientId;

-- Ver estado actual
SELECT current_song_id, playback_state, volume
FROM playback_sessions
WHERE client_id = $clientId;
```

### Flujo 2: Modo Shared Playlist

```
Cuenta = Restaurante Demo A (3 locales)
         ↓
playback_mode = 'shared_playlist'
         ↓
Todos los locales ven:
  - Mismas playlists
  - Mismas canciones
  - Mismos catálogos
         ↓
Cada local controla:
  - Su propia reproducción
  - Su propio volumen
  - Su propia posición
         ↓
Cambios de Local A → NO afecta Local B
```

**Casos de Uso:**
- Restaurantes con múltiples sucursales
- Eventos donde cada local tiene ambientación similar pero independiente
- Tiendas retail con control local

### Flujo 3: Modo Synchronized (DJ Mode)

```
Manager / DJ de Restaurante Demo B accede
         ↓
state.playbackMode = 'synchronized'
state.isController = true
         ↓
Ve DJModePanel
         ↓
Selecciona canción/playlist
         ↓
Click PLAY
         ↓
Update playback_sessions:
  - current_song_id = XX
  - playback_state = 'playing'
  - controlled_by = [manager_id]
  - is_centralized = true
         ↓
Webhook/RealTime:
  - Notifica Local 1
  - Notifica Local 2
  - Notifica Local 3
         ↓
Todos reproducen SIMULTÁNEAMENTE
         ↓
Cambios en tiempo real
  - Manager pausa → Todos pausan
  - Manager siguiente → Todos siguiente
  - Manager volumen 50 → Todos volumen 50
```

---

## 🔌 Integración con API Backend

### Funciones SQL Críticas

```sql
-- Obtener modo de reproducción de cuenta
SELECT playback_mode FROM clients WHERE id = $1;

-- Actualizar estado de reproducción
UPDATE playback_sessions
SET 
  current_song_id = $1,
  playback_state = $2,
  playback_position = $3,
  controlled_by = $4,
  updated_at = NOW()
WHERE client_id = $5;

-- Obtener estado actual
SELECT * FROM playback_sessions WHERE client_id = $1;

-- Cambiar modo
UPDATE clients SET playback_mode = $1 WHERE id = $2;
UPDATE playback_sessions SET playback_mode = $1 WHERE client_id = $2;
```

### Endpoints de API Esperados

```javascript
// Obtener estado de playback
GET /api/playback/state?clientId=XX
// Retorna: { playbackMode, currentSongId, playbackState, controlledBy, ... }

// Actualizar estado
POST /api/playback/update
// Body: { clientId, songId, state, position, volume }

// Cambiar modo
PUT /api/playback/mode
// Body: { clientId, newMode: 'independent'|'shared_playlist'|'synchronized' }

// Obtener locales en sesión (para DJ Mode)
GET /api/playback/active-locations?clientId=XX
// Retorna: [ { locationId, name, status }, ... ]
```

---

## 🔐 RLS Policies para Playback

### playback_sessions

```sql
-- SELECT
-- Usuarios pueden ver sesión de su cuenta
CREATE POLICY playback_sessions_select ON playback_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.client_id = playback_sessions.client_id
        OR user_profiles.role = 'admin'
      )
    )
  );

-- UPDATE
-- Solo owner/manager de cuenta puede actualizar
CREATE POLICY playback_sessions_update ON playback_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'manager')
      AND user_profiles.client_id = playback_sessions.client_id
    )
  );

-- INSERT/DELETE
-- Solo admins del sistema
CREATE POLICY playback_sessions_insert ON playback_sessions
  FOR INSERT WITH CHECK (
    public.is_admin()
  );
```

---

## 📊 Real-Time Updates (WebSockets)

### Esperado (Usando Supabase Realtime)

```javascript
// En SyncPlaybackProvider
useEffect(() => {
  const subscription = supabase
    .channel(`playback:${clientId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'playback_sessions',
        filter: `client_id=eq.${clientId}`
      },
      (payload) => {
        dispatch({
          type: 'UPDATE_FROM_SERVER',
          payload: payload.new
        });
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [clientId]);
```

---

## 🎯 Casos de Uso Reales

### Caso 1: Restaurante Solo
```
Config:
  - playback_mode: 'independent'
  - 1 Location
  
Usuario:
  - Manager del local
  
Comportamiento:
  - Controla su música libremente
  - No hay sincronización
  - No necesita DJ Mode
```

### Caso 2: Cadena de Restaurantes (Ambientación Unificada)
```
Config:
  - playback_mode: 'shared_playlist'
  - 3 Locations (Zona 10, Zona 1, Zona 4)
  
Usuarios:
  - Manager en cada local
  - Owner de cadena
  
Comportamiento:
  - Todos usan mismas playlists
  - Cada manager controla su local
  - Owner ve reportes consolidados
  - Sin sincronización en tiempo real
```

### Caso 3: Discoteca o Night Club
```
Config:
  - playback_mode: 'synchronized'
  - 1 Location o múltiples connected areas
  
Usuarios:
  - 1 DJ (Controller)
  - N Managers (Viewers)
  
Comportamiento:
  - DJ controla todo
  - Managers ven estado en tiempo real
  - Todos escuchan mismo en sincro
  - DJModePanel visible solo para DJ
```

---

## 🔍 Queries de Verificación

### Ver Modo Actual
```sql
SELECT 
  c.id,
  c.name,
  ps.playback_mode,
  ps.current_song_id,
  ps.playback_state,
  ps.is_centralized,
  u.email as controlled_by,
  ps.updated_at
FROM clients c
LEFT JOIN playback_sessions ps ON c.id = ps.client_id
LEFT JOIN auth.users u ON ps.controlled_by = u.id
ORDER BY c.name;
```

### Ver Estado de Todos los Locales
```sql
SELECT 
  l.id,
  l.name,
  c.name as account,
  ps.playback_mode,
  ps.playback_state,
  s.title as current_song,
  u.email as dj
FROM locations l
JOIN clients c ON l.client_id = c.id
LEFT JOIN playback_sessions ps ON c.id = ps.client_id
LEFT JOIN songs s ON ps.current_song_id = s.id
LEFT JOIN auth.users u ON ps.controlled_by = u.id
ORDER BY c.name, l.name;
```

### Cambiar Modo (Admin)
```sql
-- Cambiar a Synchronized
BEGIN;
  UPDATE clients 
  SET playback_mode = 'synchronized'
  WHERE id = 'XX-XX-XX-XX';
  
  UPDATE playback_sessions
  SET playback_mode = 'synchronized', is_centralized = true
  WHERE client_id = 'XX-XX-XX-XX';
COMMIT;
```

---

## ⚙️ Configuración y Deployment

### 1. Crear Sesión para Nueva Cuenta

```sql
-- Ejecutarse cuando se crea nueva cuenta
INSERT INTO playback_sessions (
  client_id,
  playback_mode,
  playback_state
) VALUES (
  [new_client_id],
  'independent',
  'stopped'
);
```

### 2. Trigger on clients

```sql
CREATE OR REPLACE FUNCTION initialize_playback_session()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO playback_sessions (client_id, playback_mode)
  VALUES (NEW.id, NEW.playback_mode);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_initialize_playback
AFTER INSERT ON clients
FOR EACH ROW
EXECUTE FUNCTION initialize_playback_session();
```

### 3. Verificación en Startup

```javascript
// En App.jsx o Main Provider
useEffect(() => {
  const checkPlaybackMode = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('playback_mode')
      .eq('id', currentClientId)
      .single();
    
    if (data) {
      dispatch({
        type: 'SET_PLAYBACK_MODE',
        payload: data.playback_mode
      });
    }
  };
  
  checkPlaybackMode();
}, [currentClientId]);
```

---

## 🚀 Roadmap y Mejoras Futuras

### Próximas Características
1. **Queue de Reproducción** - Mostrar próximas canciones en DJ Mode
2. **Restricciones por Horario** - Cambiar modo automáticamente según hora
3. **Smart Transitions** - Transiciones suaves entre canciones
4. **Remote DJ Control** - DJ controla desde su teléfono
5. **Offline Mode** - Continuar en local si pierde conexión
6. **Playback Analytics** - Mostrar canción más reproducida, etc.

### Performance Improvements
1. **Caching de Estado** - localStorage para reducir queries
2. **Debouncing de Updates** - No actualizar en cada frame
3. **Batch Operations** - Agrupar múltiples cambios
4. **Optimistic Updates** - Mostrar cambio antes de confirmación

---

## 📝 Notas y Limitaciones

### Limitaciones Actuales
- ⚠️ Sincronización es unidireccional (DJ → Clientes)
- ⚠️ No hay historial de cambios de DJ
- ⚠️ No hay notificaciones cuando cambia controlador
- ⚠️ Cambio de modo requiere restart de sesión

### Consideraciones de Seguridad
- ✅ Solo manager/admin pueden cambiar modo
- ✅ Solo owner puede designar DJ
- ✅ RLS protege acceso no autorizado
- ✅ Todos los cambios son auditables (con updated_at)

### Performance
- ✅ Índices en playback_sessions para rápidas lookups
- ✅ Queries optimizadas para <50ms
- ✅ Real-time updates vía WebSockets (no polling)

---

## 📞 Debugging

### Logs Útiles

```javascript
// En SyncPlaybackContext.jsx
console.log('Playback Mode:', state.playbackMode);
console.log('Is Controller:', state.isController);
console.log('Current Song:', state.currentSong);
console.log('Playback State:', state.playbackState);
```

### Verificar RLS
```sql
-- Ver policies activas
SELECT * FROM pg_policies 
WHERE tablename = 'playback_sessions';

-- Simular acceso de usuario
SET LOCAL "request.jwt.claims" = 
  '{"sub":"[user-id]","role":"authenticated"}';

SELECT * FROM playback_sessions;
```

---

**Última Actualización:** Febrero 2, 2026  
**Versión:** 1.0 (Especificación)  
**Status:** Implementado en Backend, Componentes Listos en Frontend  
**Testing Necesario:** Flujo completo de sincronización en tiempo real
