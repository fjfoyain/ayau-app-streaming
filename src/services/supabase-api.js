import { supabase } from '../lib/supabase'

/**
 * Obtener todas las playlists del usuario autenticado
 */
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

/**
 * Obtener canciones de una playlist (ordenadas por posición)
 */
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
    author: item.songs.author,
    duration: item.songs.duration,
    url: item.songs.file_url,
    coverImage: item.songs.cover_image_url,
    isrc: item.songs.isrc,
    playlistId: playlistId
  }))
}

/**
 * Registrar reproducción en play_history
 * IMPORTANTE: Se registra cuando se cambia de canción o se pausa
 */
export const recordPlay = async (userId, songId, playlistId, durationInSeconds, countryCode = 'GT') => {
  const { error } = await supabase
    .from('play_history')
    .insert({
      user_id: userId,
      song_id: songId,
      playlist_id: playlistId,
      stream_duration: durationInSeconds,
      country_code: countryCode
    })

  if (error) {
    console.error('Error recording play:', error)
    throw error
  }

  console.log(`✅ Recorded ${durationInSeconds} seconds for song ${songId}`)
}

/**
 * Obtener sesión de reproducción de un cliente
 * Para modo centralizado/broadcasting
 */
export const getPlaybackSession = async (clientId) => {
  const { data, error } = await supabase
    .from('playback_sessions')
    .select('*')
    .eq('client_id', clientId)
    .single()

  if (error) throw error
  return data
}

/**
 * Actualizar sesión de reproducción (para modo centralizado)
 */
export const updatePlaybackSession = async (clientId, updates) => {
  const { error } = await supabase
    .from('playback_sessions')
    .update(updates)
    .eq('client_id', clientId)

  if (error) throw error
}

/**
 * Suscribirse a cambios en la sesión de reproducción
 * Para sincronizar reproducción entre locales
 */
export const subscribeToPlaybackSession = (clientId, callback) => {
  const channel = supabase
    .channel('playback-control')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'playback_sessions',
        filter: `client_id=eq.${clientId}`
      },
      callback
    )
    .subscribe()

  return channel
}
