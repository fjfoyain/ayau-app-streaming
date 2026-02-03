# Sistema de Asignación de Playlists

## Resumen

Este sistema permite asignar playlists a cuentas (clientes) y luego a locales específicos dentro de esas cuentas.

## Flujo de Asignación

```
1. CREAR PLAYLISTS (PlaylistManager)
   ↓
2. ASIGNAR A CUENTA (AccountManager → Gestionar Playlists)
   ↓
3. ASIGNAR A LOCAL (VenueManager → Gestionar Playlists)
   ↓
4. REPRODUCIR (Usuario final en el local)
```

## Cómo Funciona

### 1. Asignar Playlists a una Cuenta

**Ubicación:** Admin Dashboard → Cuentas → Icono 🎵 (Gestionar Playlists)

**Pasos:**
1. Click en el icono morado de música (🎵) en la fila de la cuenta
2. Se abrirá el diálogo "Playlists de [Nombre Cuenta]"
3. Seleccionar una playlist del dropdown
4. Click en "Asignar"
5. La playlist aparecerá en la lista de playlists asignadas

**Notas:**
- Solo admin y managers pueden asignar playlists a cuentas
- Puedes asignar múltiples playlists a una cuenta
- Al remover una playlist de una cuenta, también se remueve de todos sus locales

### 2. Asignar Playlists a un Local

**Ubicación:** Admin Dashboard → Locales → Icono 🎵 (Gestionar Playlists)

**Pasos:**
1. Click en el icono morado de música (🎵) en la fila del local
2. Se abrirá el diálogo "Playlists de [Nombre Local]"
3. **Solo verás las playlists ya asignadas a la cuenta del local**
4. Seleccionar una playlist del dropdown
5. Click en "Asignar"
6. La playlist aparecerá en la lista de playlists asignadas al local

**Notas:**
- Solo puedes asignar playlists que ya están asignadas a la cuenta
- Si no ves playlists disponibles, primero debes asignarlas a la cuenta
- Un local puede tener algunas o todas las playlists de su cuenta

## Jerarquía

```
📦 Sistema
│
├── 🎵 Playlist Global 1
├── 🎵 Playlist Global 2
└── 🎵 Playlist Global 3
    │
    ├── 🏢 Cuenta: "Restaurante XYZ"
    │   ├── ✅ Playlist 1 (asignada)
    │   └── ✅ Playlist 2 (asignada)
    │       │
    │       ├── 📍 Local: "Sucursal Centro"
    │       │   └── ✅ Playlist 1 (disponible para reproducir)
    │       │
    │       └── 📍 Local: "Sucursal Zona 10"
    │           ├── ✅ Playlist 1 (disponible para reproducir)
    │           └── ✅ Playlist 2 (disponible para reproducir)
    │
    └── 🏢 Cuenta: "Bar ABC"
        └── ✅ Playlist 3 (asignada)
            │
            └── 📍 Local: "Bar Centro"
                └── ✅ Playlist 3 (disponible para reproducir)
```

## Casos de Uso

### Caso 1: Cadena de Restaurantes con Música Diferenciada

**Escenario:** Restaurante "El Buen Sabor" tiene 3 sucursales con ambientes diferentes

1. **Asignar a la cuenta** "El Buen Sabor":
   - Playlist "Jazz Suave"
   - Playlist "Pop Alegre"
   - Playlist "Clásica Elegante"

2. **Asignar a locales**:
   - Sucursal Centro (ambiente formal):
     - Playlist "Jazz Suave"
     - Playlist "Clásica Elegante"
   
   - Sucursal Zona 10 (ambiente joven):
     - Playlist "Pop Alegre"
   
   - Sucursal Carretera (ambiente familiar):
     - Playlist "Jazz Suave"
     - Playlist "Pop Alegre"

### Caso 2: Bar Independiente

**Escenario:** Bar "La Noche" tiene un solo local

1. **Asignar a la cuenta** "La Noche":
   - Playlist "Rock Clásico"
   - Playlist "Electrónica"

2. **Asignar al local**:
   - Local "La Noche":
     - Playlist "Rock Clásico"
     - Playlist "Electrónica"

## Base de Datos

### Tablas

#### `account_playlists`
Playlists asignadas a cuentas
```sql
- id (UUID)
- client_id (UUID) → clients.id
- playlist_id (UUID) → playlists.id
- is_active (BOOLEAN)
- assigned_at (TIMESTAMPTZ)
- assigned_by (UUID) → user_profiles.id
```

#### `location_playlists`
Playlists asignadas a locales
```sql
- id (UUID)
- location_id (UUID) → locations.id
- playlist_id (UUID) → playlists.id
- is_active (BOOLEAN)
- assigned_at (TIMESTAMPTZ)
- assigned_by (UUID) → user_profiles.id
```

### Funciones SQL

- `assign_playlist_to_account(client_id, playlist_id)` - Asignar playlist a cuenta
- `remove_playlist_from_account(client_id, playlist_id)` - Remover playlist de cuenta
- `assign_playlist_to_location(location_id, playlist_id)` - Asignar playlist a local
- `remove_playlist_from_location(location_id, playlist_id)` - Remover playlist de local
- `get_account_playlists(client_id)` - Obtener playlists de una cuenta
- `get_location_playlists(location_id)` - Obtener playlists de un local
- `get_available_playlists_for_location(location_id)` - Obtener playlists disponibles para asignar a un local

## API Frontend

### Funciones disponibles en `supabase-api.js`:

```javascript
// Cuentas
getAccountPlaylists(clientId)
assignPlaylistToAccount(clientId, playlistId)
removePlaylistFromAccount(clientId, playlistId)

// Locales
getLocationPlaylists(locationId)
getAvailablePlaylistsForLocation(locationId)
assignPlaylistToLocation(locationId, playlistId)
removePlaylistFromLocation(locationId, playlistId)

// General
getAllPlaylistsForAssignment() // Todas las playlists disponibles
```

## Componentes React

### `AccountPlaylistManager.jsx`
Diálogo para gestionar playlists de una cuenta
- Muestra playlists asignadas
- Permite asignar nuevas playlists
- Permite remover playlists

### `LocationPlaylistManager.jsx`
Diálogo para gestionar playlists de un local
- Muestra playlists asignadas
- Muestra solo playlists disponibles de la cuenta
- Permite asignar playlists de la cuenta al local
- Permite remover playlists del local

## Permisos

### Admin y Manager
- Asignar playlists a cuentas ✅
- Asignar playlists a locales ✅
- Remover playlists ✅

### Usuario Cadena
- Ver playlists de su cuenta ✅
- Ver playlists de sus locales ✅
- Asignar/remover ❌ (requiere admin/manager)

### Usuario Local
- Ver playlists de su local ✅
- Reproducir playlists asignadas ✅
- Asignar/remover ❌ (requiere admin/manager)

## Validaciones

1. **Al asignar a local:** Verifica que la playlist esté asignada a la cuenta del local
2. **Al remover de cuenta:** Automáticamente remueve de todos los locales de esa cuenta
3. **Duplicados:** No permite asignar la misma playlist dos veces
4. **Permisos:** Solo admin y managers pueden gestionar asignaciones

## Instalación

### 1. Ejecutar SQL
```bash
psql -U postgres -d ayau < database/setup-playlist-assignments.sql
```

### 2. Verificar tablas
Las tablas y funciones deberían estar creadas. Verificar con:
```sql
SELECT * FROM account_playlists;
SELECT * FROM location_playlists;
```

### 3. Reiniciar app
```bash
npm run dev
```

## Testing

### Test básico:
1. Crear una playlist en PlaylistManager
2. Ir a AccountManager → Click en icono 🎵 de una cuenta
3. Asignar la playlist a la cuenta
4. Ir a VenueManager → Click en icono 🎵 de un local de esa cuenta
5. Verificar que la playlist aparece como disponible
6. Asignar la playlist al local
7. Verificar que aparece en la lista de playlists asignadas

## Troubleshooting

**Problema:** No veo el icono 🎵 en las tablas
- **Solución:** Verificar que los componentes se hayan actualizado correctamente

**Problema:** No aparecen playlists disponibles para un local
- **Solución:** Primero asignar playlists a la cuenta del local

**Problema:** Error al asignar playlist
- **Solución:** Verificar que el usuario tenga permisos de admin o manager

**Problema:** Error SQL al ejecutar funciones
- **Solución:** Verificar que el archivo SQL se haya ejecutado correctamente y que las funciones existan
