import { supabase } from '../lib/supabase'

/**
 * Obtener todas las playlists del usuario autenticado
 * Las políticas RLS se encargan de filtrar automáticamente:
 * - Admins ven TODAS las playlists
 * - Usuarios regulares solo ven playlists públicas o con permisos asignados
 */
export const getUserPlaylists = async () => {
  // Consultar directamente playlists - RLS filtra automáticamente
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching playlists:', error);
    throw error;
  }

  return data;
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

// ================================================
// ADMIN PANEL API FUNCTIONS
// ================================================

/**
 * Verificar si el usuario actual es admin
 */
export const isAdmin = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) return false
  return data.role === 'admin'
}

export const isManagerOrAdmin = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) return false
  return data.role === 'admin' || data.role === 'manager'
}

export const getUserRole = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) return null
  return data.role
}

// ================================================
// PLAYLIST MANAGEMENT
// ================================================

/**
 * Crear nueva playlist
 */
export const createPlaylist = async (playlistData) => {
  const { data, error } = await supabase
    .from('playlists')
    .insert({
      name: playlistData.name,
      description: playlistData.description,
      cover_image_url: playlistData.cover_image_url,
      is_public: playlistData.is_public ?? false
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Actualizar playlist existente
 */
export const updatePlaylist = async (playlistId, updates) => {
  const { data, error } = await supabase
    .from('playlists')
    .update(updates)
    .eq('id', playlistId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Eliminar playlist
 */
export const deletePlaylist = async (playlistId) => {
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)

  if (error) throw error
}

// ================================================
// SONG MANAGEMENT
// ================================================

/**
 * Obtener todas las canciones (admin)
 */
export const getAllSongs = async () => {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('title')

  if (error) throw error
  return data
}

/**
 * Crear nueva canción
 */
export const createSong = async (songData) => {
  const { data, error } = await supabase
    .from('songs')
    .insert({
      title: songData.title,
      performer: songData.performer,
      author: songData.author,
      duration: songData.duration,
      file_url: songData.file_url,
      cover_image_url: songData.cover_image_url,
      isrc: songData.isrc
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Actualizar canción
 */
export const updateSong = async (songId, updates) => {
  const { data, error } = await supabase
    .from('songs')
    .update(updates)
    .eq('id', songId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Eliminar canción
 */
export const deleteSong = async (songId) => {
  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', songId)

  if (error) throw error
}

/**
 * Agregar canción a playlist
 */
export const addSongToPlaylist = async (playlistId, songId, position) => {
  const { data, error } = await supabase
    .from('playlist_songs')
    .insert({
      playlist_id: playlistId,
      song_id: songId,
      position: position
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Remover canción de playlist
 */
export const removeSongFromPlaylist = async (playlistId, songId) => {
  const { error } = await supabase
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('song_id', songId)

  if (error) throw error
}

// ================================================
// USER MANAGEMENT
// ================================================

/**
 * Obtener todos los usuarios
 */
export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('full_name')

  if (error) {
    console.error('Error in getAllUsers:', error)
    throw error
  }

  return data
}

/**
 * Crear nuevo usuario con signup
 * El usuario recibirá un email de confirmación
 * El trigger de la base de datos creará automáticamente el perfil
 */
export const createUser = async (userData) => {
  // Registrar usuario (enviará email de confirmación)
  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password || generateRandomPassword(),
    options: {
      data: {
        full_name: userData.full_name,
        role: userData.role || 'user'
      },
      emailRedirectTo: window.location.origin
    }
  })

  if (error) throw error

  // El trigger handle_new_user() creará automáticamente el perfil
  // Esperar un momento para que se cree el perfil
  await new Promise(resolve => setTimeout(resolve, 1000))

  return data.user
}

/**
 * Generar contraseña aleatoria segura
 */
const generateRandomPassword = () => {
  const length = 12
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

/**
 * Actualizar perfil de usuario
 */
export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Asignar playlist a usuario
 */
export const assignPlaylistToUser = async (userId, playlistId, permissionLevel = 'view') => {
  const { data, error } = await supabase
    .from('playlist_permissions')
    .insert({
      user_id: userId,
      playlist_id: playlistId,
      permission_level: permissionLevel
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Remover asignación de playlist
 */
export const removePlaylistFromUser = async (userId, playlistId) => {
  const { error } = await supabase
    .from('playlist_permissions')
    .delete()
    .eq('user_id', userId)
    .eq('playlist_id', playlistId)

  if (error) throw error
}

/**
 * Obtener permisos de un usuario
 */
export const getUserPermissions = async (userId) => {
  const { data, error } = await supabase
    .from('playlist_permissions')
    .select(`
      *,
      playlists (
        id,
        name
      )
    `)
    .eq('user_id', userId)

  if (error) throw error
  return data
}

// ================================================
// ANALYTICS
// ================================================

/**
 * Obtener estadísticas de reproducción
 */
export const getPlayStats = async (filters = {}) => {
  let query = supabase
    .from('play_history')
    .select(`
      *,
      songs (
        title,
        performer
      ),
      playlists (
        name
      ),
      user_profiles (
        full_name
      )
    `)

  if (filters.startDate) {
    query = query.gte('played_at', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('played_at', filters.endDate)
  }
  if (filters.songId) {
    query = query.eq('song_id', filters.songId)
  }

  const { data, error } = await query.order('played_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Obtener analytics mensuales agregados
 */
export const getMonthlyAnalytics = async (year, month) => {
  const { data, error } = await supabase
    .from('stream_analytics_monthly')
    .select('*')
    .eq('year', year)
    .eq('month', month)

  if (error) throw error
  return data
}

// ================================================
// STORAGE / FILE UPLOAD
// ================================================

/**
 * Subir archivo de audio a Supabase Storage
 */
export const uploadAudioFile = async (file, songId) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${songId}.${fileExt}`
  const filePath = `${fileName}`

  const { error } = await supabase.storage
    .from('songs')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    })

  if (error) throw error

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('songs')
    .getPublicUrl(filePath)

  return publicUrl
}

/**
 * Subir imagen de portada a Supabase Storage
 */
export const uploadCoverImage = async (file, songId) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${songId}.${fileExt}`
  const filePath = `${fileName}`

  const { error } = await supabase.storage
    .from('covers')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    })

  if (error) throw error

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('covers')
    .getPublicUrl(filePath)

  return publicUrl
}

/**
 * Obtener todas las playlists donde está una canción
 */
export const getSongPlaylists = async (songId) => {
  const { data, error } = await supabase
    .from('playlist_songs')
    .select(`
      playlist_id,
      playlists (
        id,
        name
      )
    `)
    .eq('song_id', songId)

  if (error) throw error
  return data.map(item => item.playlists)
}
/**
 * Obtener signed URL (temporal) para un archivo en Storage
 * `filePath` expected format: "bucket/path/to/file.ext" or "path/to/file.ext" (if no bucket provided, assumes `songs`)
 */
export const getSignedUrl = async (filePath, expires = 3600) => {
  if (!filePath) throw new Error('filePath required')
  const parts = filePath.split('/')
  const bucket = parts.length > 1 ? parts[0] : 'songs'
  const path = parts.length > 1 ? parts.slice(1).join('/') : filePath

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires)
  if (error) {
    console.error('Error creating signed URL:', error)
    throw error
  }
  return data.signedUrl
}