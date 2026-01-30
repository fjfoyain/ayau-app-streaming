# 📊 Tracking de Reproducción para Regalías

## Objetivo

Registrar **exactamente cuántos segundos** se reproduce cada canción por cada usuario para calcular regalías justas.

### Ejemplo del Caso de Uso:
- **Cliente A** reproduce "Canción X" → 2 minutos 30 segundos (150 seg)
- **Cliente B** reproduce "Canción X" → 1 minuto (60 seg)
- **Reporte**: "Canción X" = **3 minutos 30 segundos** (210 seg) en total

---

## 🎯 Criterios de Validez para Regalías

Según estándares de la industria musical:

1. **Stream Válido**: Reproducción de al menos **30 segundos**
2. **Stream Completo**: Reproducción de más del **50% de la duración** de la canción
3. **Tracking Preciso**: Registrar segundos exactos, no estimaciones

---

## 📝 Schema de Base de Datos

### Tabla: `play_history`

```sql
CREATE TABLE play_history (
  id UUID PRIMARY KEY,
  user_id UUID,           -- Usuario que reproduce
  song_id UUID,           -- Canción reproducida
  playlist_id UUID,       -- Playlist (opcional)

  -- CRÍTICO para regalías
  stream_duration INTEGER,        -- Segundos reproducidos
  valid_for_royalties BOOLEAN,    -- true si >=30 segundos
  completed BOOLEAN,              -- true si >50% de la canción

  country_code VARCHAR(2),        -- País del usuario
  played_at TIMESTAMPTZ           -- Cuándo se reprodujo
);
```

### Triggers Automáticos

El schema incluye triggers que **automáticamente** calculan:
- `valid_for_royalties`: true si `stream_duration >= 30`
- `completed`: true si `stream_duration > (song.duration * 0.5)`

**Solo necesitas guardar** `user_id`, `song_id`, `stream_duration` y el resto se calcula automáticamente.

---

## 💻 Implementación en el Frontend

### 1. Actualizar MusicPlayer Component

Modificar `src/components/MusicPlayer.jsx` para trackear segundos:

```javascript
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MusicPlayer({ currentSong }) {
  const audioRef = useRef(null)
  const [playbackStartTime, setPlaybackStartTime] = useState(null)
  const [totalSecondsPlayed, setTotalSecondsPlayed] = useState(0)
  const hasRecordedPlay = useRef(false)

  // Cuando se empieza a reproducir
  const handlePlay = () => {
    setPlaybackStartTime(Date.now())
    hasRecordedPlay.current = false
  }

  // Cuando se pausa
  const handlePause = () => {
    if (playbackStartTime) {
      const secondsPlayed = Math.floor((Date.now() - playbackStartTime) / 1000)
      setTotalSecondsPlayed(prev => prev + secondsPlayed)
      setPlaybackStartTime(null)
    }
  }

  // Cuando termina la canción
  const handleEnded = () => {
    handlePause() // Guardar últimos segundos
    recordPlayHistory()
  }

  // Cuando cambia de canción o se desmonta el componente
  useEffect(() => {
    return () => {
      // Guardar progreso cuando se cambia de canción
      if (totalSecondsPlayed > 0 && !hasRecordedPlay.current) {
        recordPlayHistory()
      }
    }
  }, [currentSong?.id])

  // Función para registrar en Supabase
  const recordPlayHistory = async () => {
    if (hasRecordedPlay.current || totalSecondsPlayed === 0) return

    hasRecordedPlay.current = true

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || !currentSong?.id) return

      const { error } = await supabase
        .from('play_history')
        .insert({
          user_id: user.id,
          song_id: currentSong.id,
          playlist_id: currentSong.playlistId || null,
          stream_duration: totalSecondsPlayed,
          country_code: 'GT' // TODO: Detectar país del usuario
        })

      if (error) {
        console.error('Error recording play:', error)
      } else {
        console.log(`✅ Recorded ${totalSecondsPlayed} seconds for "${currentSong.title}"`)
      }
    } catch (error) {
      console.error('Error in recordPlayHistory:', error)
    } finally {
      setTotalSecondsPlayed(0)
    }
  }

  // Registrar cada 30 segundos (por seguridad, en caso de cierre inesperado)
  useEffect(() => {
    const interval = setInterval(() => {
      if (playbackStartTime && totalSecondsPlayed > 30) {
        handlePause()
        recordPlayHistory()
        setPlaybackStartTime(Date.now()) // Reiniciar tracking
      }
    }, 30000) // Cada 30 segundos

    return () => clearInterval(interval)
  }, [playbackStartTime, totalSecondsPlayed])

  return (
    <audio
      ref={audioRef}
      src={currentSong?.url}
      onPlay={handlePlay}
      onPause={handlePause}
      onEnded={handleEnded}
      controls
    />
  )
}
```

### 2. Detectar País del Usuario (Opcional)

Para reportes geográficos, agregar detección de país:

```javascript
// src/utils/getCountryCode.js
export async function getCountryCode() {
  try {
    const response = await fetch('https://ipapi.co/json/')
    const data = await response.json()
    return data.country_code || 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

// Usar en MusicPlayer:
import { getCountryCode } from '../utils/getCountryCode'

// En recordPlayHistory:
const countryCode = await getCountryCode()

await supabase.from('play_history').insert({
  // ...
  country_code: countryCode
})
```

### 3. Alternativa: Usar HTML5 Audio Events

Si usas `react-audio-player` o un player personalizado:

```javascript
import ReactAudioPlayer from 'react-audio-player'

<ReactAudioPlayer
  src={currentSong?.url}
  onListen={(currentTime) => {
    // Se dispara cada segundo mientras reproduce
    // Usar esto para tracking más preciso
  }}
  onEnded={handleEnded}
  listenInterval={1000} // Actualizar cada segundo
/>
```

---

## 📊 Consultas de Reportes

### Query 1: Total de Segundos por Canción (Todos los Tiempos)

```sql
SELECT
  s.title,
  s.performer,
  s.isrc,
  SUM(ph.stream_duration) as total_seconds_played,
  ROUND(SUM(ph.stream_duration)::float / 60, 2) as total_minutes,
  ROUND(SUM(ph.stream_duration)::float / 3600, 2) as total_hours
FROM songs s
LEFT JOIN play_history ph ON s.id = ph.song_id
WHERE ph.valid_for_royalties = true  -- Solo streams válidos (>=30 seg)
GROUP BY s.id, s.title, s.performer, s.isrc
ORDER BY total_seconds_played DESC;
```

**Resultado Ejemplo**:
```
title            | performer     | isrc        | total_seconds | total_minutes | total_hours
-----------------|---------------|-------------|---------------|---------------|-------------
"Bohemian Rhaps" | Queen         | GBUM71029604| 125430        | 2090.50       | 34.84
"Stairway..."    | Led Zeppelin  | USRC17607839| 98750         | 1645.83       | 27.43
```

### Query 2: Reporte Mensual

```sql
SELECT * FROM royalty_report_monthly
WHERE year = 2024 AND month = 1
ORDER BY total_seconds_played DESC;
```

### Query 3: Top 100 Canciones del Mes

```sql
SELECT * FROM get_top_songs_by_playback(100, 2024, 1);
```

### Query 4: Reporte de una Canción Específica

```sql
SELECT * FROM get_song_monthly_report(
  'song-uuid-here',
  2024,
  1  -- Enero
);
```

---

## 🔄 Proceso de Agregación Mensual

El 1º de cada mes, ejecutar:

```sql
SELECT * FROM aggregate_monthly_analytics(2024, 1); -- Enero 2024
```

Esto:
1. Lee todos los registros de `play_history` del mes
2. Suma total de segundos por canción
3. Cuenta streams válidos y completos
4. Agrupa por país
5. Guarda todo en `stream_analytics_monthly`

**Resultado**:
```
songs_processed | total_seconds_aggregated
----------------|-------------------------
        847     |         15,234,567
```

---

## 📈 Views Disponibles

### 1. `royalty_report_all_time`
Reporte completo de todos los tiempos

```sql
SELECT * FROM royalty_report_all_time
WHERE total_seconds_played > 0
ORDER BY total_seconds_played DESC
LIMIT 100;
```

### 2. `royalty_report_monthly`
Reporte mes por mes

```sql
SELECT * FROM royalty_report_monthly
WHERE year = 2024
ORDER BY month DESC, total_seconds_played DESC;
```

### 3. `royalty_report_yearly`
Reporte anual (suma de todos los meses)

```sql
SELECT * FROM royalty_report_yearly
WHERE year = 2024;
```

### 4. `royalty_report_by_country`
Distribución geográfica

```sql
SELECT * FROM royalty_report_by_country
WHERE song_id = 'uuid-de-cancion'
ORDER BY total_seconds_played DESC;
```

---

## 💰 Cálculo de Regalías

### Fórmula Básica

```
Regalías = Total de segundos reproducidos × Tasa por segundo
```

O si prefieres por stream:

```
Regalías = Total de streams válidos × Tasa fija por stream
```

### Ejemplo con Tasas Reales

**Opción 1: Por Stream** (más común)
- Tasa típica: $0.003 - $0.005 por stream
- Stream válido: ≥30 segundos

```sql
SELECT
  title,
  performer,
  total_valid_streams,
  ROUND(total_valid_streams * 0.004, 2) as royalty_usd
FROM royalty_report_monthly
WHERE year = 2024 AND month = 1;
```

**Opción 2: Por Segundo** (más justo)
- Tasa por segundo: $0.000015 (aprox)

```sql
SELECT
  title,
  performer,
  total_seconds_played,
  ROUND(total_seconds_played * 0.000015, 2) as royalty_usd
FROM royalty_report_monthly
WHERE year = 2024 AND month = 1;
```

---

## 🎯 Checklist de Implementación

### Backend (Supabase)
- [ ] Ejecutar `supabase-schema-reportes.sql`
- [ ] Verificar que triggers funcionan
- [ ] Probar views de reportes

### Frontend
- [ ] Actualizar MusicPlayer con tracking
- [ ] Implementar `recordPlayHistory()`
- [ ] Agregar detección de país (opcional)
- [ ] Probar con canciones reales

### Testing
- [ ] Reproducir canción completa → verificar segundos en DB
- [ ] Reproducir 15 segundos → verificar `valid_for_royalties = false`
- [ ] Reproducir 35 segundos → verificar `valid_for_royalties = true`
- [ ] Reproducir >50% → verificar `completed = true`

### Reportes
- [ ] Ejecutar query de segundos totales
- [ ] Verificar suma de cliente A + cliente B = total correcto
- [ ] Generar reporte mensual de prueba

---

## 📌 Notas Importantes

1. **Precisión del Tracking**:
   - Registrar cada 30 segundos por seguridad (en caso de cierre de tab)
   - Registrar al final de la canción
   - Registrar al cambiar de canción

2. **Optimización**:
   - No hacer query a Supabase por cada segundo
   - Acumular en memoria y guardar periódicamente

3. **Privacidad**:
   - Solo guardar datos anónimos de reproducción
   - Country code es opcional

4. **Validación**:
   - Triggers automáticos validan los datos
   - No necesitas calcular `valid_for_royalties` manualmente

---

¿Alguna pregunta sobre el tracking o los reportes? 🎵
