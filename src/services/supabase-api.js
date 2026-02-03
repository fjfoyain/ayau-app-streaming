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

  // Convert playlist cover images to signed URLs
  const playlistsWithSignedCovers = await Promise.all(
    data.map(async (playlist) => {
      let coverUrl = playlist.cover_image_url;

      // Convert cover to signed URL if it's a storage path (not http/https)
      if (coverUrl && !/^https?:\/\//i.test(coverUrl)) {
        try {
          coverUrl = await getSignedUrl(coverUrl, 3600);
        } catch (err) {
          console.warn(`Failed to get signed URL for playlist cover ${coverUrl}:`, err);
          coverUrl = null; // Fallback to no cover
        }
      }

      return {
        ...playlist,
        cover_image_url: coverUrl
      };
    })
  );

  return playlistsWithSignedCovers;
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

  // Transform for player and convert cover images to signed URLs
  const songsWithSignedCovers = await Promise.all(
    data.map(async (item) => {
      let coverUrl = item.songs.cover_image_url;

      // Convert cover to signed URL if it's a storage path (not http/https)
      if (coverUrl && !/^https?:\/\//i.test(coverUrl)) {
        try {
          coverUrl = await getSignedUrl(coverUrl, 3600);
        } catch (err) {
          console.warn(`Failed to get signed URL for cover ${coverUrl}:`, err);
          coverUrl = null; // Fallback to no cover
        }
      }

      return {
        id: item.songs.id,
        title: item.songs.title,
        performer: item.songs.performer,
        author: item.songs.author,
        duration: item.songs.duration,
        url: item.songs.file_url,
        coverImage: coverUrl,
        isrc: item.songs.isrc,
        playlistId: playlistId
      };
    })
  );

  return songsWithSignedCovers;
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

  // Convert song cover images to signed URLs
  const songsWithSignedCovers = await Promise.all(
    data.map(async (song) => {
      let coverUrl = song.cover_image_url;

      // Convert cover to signed URL if it's a storage path (not http/https)
      if (coverUrl && !/^https?:\/\//i.test(coverUrl)) {
        try {
          coverUrl = await getSignedUrl(coverUrl, 3600);
        } catch (err) {
          console.warn(`Failed to get signed URL for song cover ${coverUrl}:`, err);
          coverUrl = null; // Fallback to no cover
        }
      }

      return {
        ...song,
        cover_image_url: coverUrl
      };
    })
  );

  return songsWithSignedCovers;
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
      album: songData.album || null,
      duration: songData.duration,
      file_url: songData.file_url,
      cover_image_url: songData.cover_image_url,
      isrc: songData.isrc,
      iswc: songData.iswc || null,
      ipi: songData.ipi || null,
      code: songData.code || null
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
    .not('email', 'like', '%.deleted.%')  // Hide deleted users (with .deleted. in email)
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
  const filePath = `songs/${fileName}` // Include bucket name in path

  const { error } = await supabase.storage
    .from('songs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    })

  if (error) throw error

  // Return path for private bucket (will be converted to signed URL by PlayerContext)
  return filePath
}

/**
 * Subir imagen de portada a Supabase Storage
 */
export const uploadCoverImage = async (file, songId) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${songId}.${fileExt}`
  const filePath = `covers/${fileName}` // Include bucket name in path

  const { error } = await supabase.storage
    .from('covers')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    })

  if (error) throw error

  // Return path for private bucket (will be converted to signed URL by PlayerContext)
  return filePath
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

// ================================================
// ACCOUNT (CLIENT) MANAGEMENT
// ================================================

/**
 * Obtener todas las cuentas/clientes con conteo de locales
 */
export const getAllAccounts = async () => {
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      locations (id)
    `)
    .order('name')

  if (error) {
    console.error('Error fetching accounts:', error)
    throw error
  }

  // Add venue_count from the locations array
  return data.map(account => ({
    ...account,
    venue_count: account.locations?.length || 0,
    locations: undefined // Remove the locations array from the response
  }))
}

/**
 * Crear nueva cuenta/cliente
 */
export const createAccount = async (accountData) => {
  // Build insert object - only include owner_id if provided and column exists
  const insertData = {
    name: accountData.name,
    contact_phone: accountData.contact_phone,
    tax_id: accountData.tax_id,
    is_active: accountData.is_active ?? true
  }

  // Add optional fields if provided
  if (accountData.owner_id) insertData.owner_id = accountData.owner_id
  if (accountData.playback_mode) insertData.playback_mode = accountData.playback_mode

  const { data, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    // If error is about owner_id column, retry without it
    if (error.message?.includes('owner_id')) {
      const { owner_id, ...dataWithoutOwner } = insertData
      const { data: retryData, error: retryError } = await supabase
        .from('clients')
        .insert(dataWithoutOwner)
        .select()
        .single()

      if (retryError) {
        console.error('Error creating account:', retryError)
        throw retryError
      }
      return retryData
    }
    console.error('Error creating account:', error)
    throw error
  }
  return data
}

/**
 * Actualizar cuenta/cliente
 */
export const updateAccount = async (accountId, updates) => {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', accountId)
    .select()
    .single()

  if (error) {
    console.error('Error updating account:', error)
    throw error
  }
  return data
}

/**
 * Eliminar cuenta/cliente
 */
export const deleteAccount = async (accountId) => {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', accountId)

  if (error) {
    console.error('Error deleting account:', error)
    throw error
  }
}

/**
 * Obtener cuentas con estadísticas (venues count, plays, etc.)
 */
export const getAccountsWithStats = async () => {
  const { data, error } = await supabase
    .from('analytics_by_account')
    .select('*')
    .order('account_name')

  if (error) {
    console.error('Error fetching accounts with stats:', error)
    throw error
  }
  return data
}

// ================================================
// VENUE (LOCATION) MANAGEMENT
// ================================================

/**
 * Obtener todos los locales/venues
 */
export const getAllVenues = async () => {
  const { data, error } = await supabase
    .from('locations')
    .select(`
      *,
      clients (
        id,
        name
      )
    `)
    .order('name')

  if (error) {
    console.error('Error fetching venues:', error)
    throw error
  }
  return data
}

/**
 * Obtener venues de una cuenta específica
 */
export const getVenuesForAccount = async (accountId) => {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('client_id', accountId)
    .order('name')

  if (error) {
    console.error('Error fetching venues for account:', error)
    throw error
  }
  return data
}

/**
 * Crear nuevo local/venue
 */
export const createVenue = async (venueData) => {
  // Build insert object - only include manager_id if provided and column exists
  const insertData = {
    client_id: venueData.client_id,
    name: venueData.name,
    address: venueData.address,
    city: venueData.city,
    country_code: venueData.country_code || 'GT',
    is_active: venueData.is_active ?? true
  }

  // Add optional manager_id if provided
  if (venueData.manager_id) insertData.manager_id = venueData.manager_id

  const { data, error } = await supabase
    .from('locations')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    // If error is about manager_id column, retry without it
    if (error.message?.includes('manager_id')) {
      const { manager_id, ...dataWithoutManager } = insertData
      const { data: retryData, error: retryError } = await supabase
        .from('locations')
        .insert(dataWithoutManager)
        .select()
        .single()

      if (retryError) {
        console.error('Error creating venue:', retryError)
        throw retryError
      }
      return retryData
    }
    console.error('Error creating venue:', error)
    throw error
  }
  return data
}

/**
 * Actualizar local/venue
 */
export const updateVenue = async (venueId, updates) => {
  const { data, error } = await supabase
    .from('locations')
    .update(updates)
    .eq('id', venueId)
    .select()
    .single()

  if (error) {
    console.error('Error updating venue:', error)
    throw error
  }
  return data
}

/**
 * Eliminar local/venue
 */
export const deleteVenue = async (venueId) => {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', venueId)

  if (error) {
    console.error('Error deleting venue:', error)
    throw error
  }
}

/**
 * Obtener venues con estadísticas
 */
export const getVenuesWithStats = async () => {
  const { data, error } = await supabase
    .from('analytics_by_venue')
    .select('*')
    .order('account_name', 'venue_name')

  if (error) {
    console.error('Error fetching venues with stats:', error)
    throw error
  }
  return data
}

// ================================================
// USER MANAGEMENT UPDATES (access levels)
// ================================================

/**
 * Crear usuario con nivel de acceso (account o location)
 */
export const createUserWithAccess = async (userData) => {
  // First create the auth user
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

  if (error) {
    console.error('Error creating user:', error)
    throw error
  }

  // Wait for profile to be created by trigger
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Update profile with access level and account/venue assignment
  const profileUpdates = {
    access_level: userData.access_level || 'location'
  }

  if (userData.access_level === 'account') {
    profileUpdates.client_id = userData.client_id
    profileUpdates.location_id = null
  } else {
    profileUpdates.location_id = userData.location_id
    // Optionally clear client_id for clarity
    profileUpdates.client_id = null
  }

  await updateUserProfile(data.user.id, profileUpdates)

  return data.user
}

/**
 * Obtener detalles de acceso de un usuario
 */
export const getUserAccessDetails = async (userId) => {
  const { data, error } = await supabase
    .from('user_access_summary')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Error fetching user access details:', error)
    throw error
  }
  return data
}

// ================================================
// ANALYTICS UPDATES (account/venue filtering)
// ================================================

/**
 * Obtener analytics por cuenta
 */
export const getAnalyticsByAccount = async (accountId = null) => {
  let query = supabase
    .from('analytics_by_account')
    .select('*')

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query.order('account_name')

  if (error) {
    console.error('Error fetching analytics by account:', error)
    throw error
  }
  return data
}

/**
 * Obtener analytics por venue
 */
export const getAnalyticsByVenue = async (accountId = null, venueId = null) => {
  let query = supabase
    .from('analytics_by_venue')
    .select('*')

  if (accountId) {
    query = query.eq('account_id', accountId)
  }
  if (venueId) {
    query = query.eq('venue_id', venueId)
  }

  const { data, error } = await query.order('account_name').order('venue_name')

  if (error) {
    console.error('Error fetching analytics by venue:', error)
    throw error
  }
  return data
}

// ================================================
// SYNCHRONIZED PLAYBACK
// ================================================

/**
 * Obtener el perfil completo del usuario actual con info de cliente/local
 */
export const getCurrentUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      clients!client_id (*),
      locations!location_id (*, clients!client_id (*))
    `)
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
  return data
}

/**
 * Obtener el client_id del usuario actual
 * Para usuarios account-level: devuelve su client_id
 * Para usuarios location-level: devuelve el client_id de su location
 */
export const getCurrentUserClientId = async () => {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  if (profile.access_level === 'account' && profile.client_id) {
    return profile.client_id
  } else if (profile.location_id && profile.locations) {
    return profile.locations.client_id
  }
  return null
}

/**
 * Obtener el modo de reproducción de una cuenta
 */
export const getClientPlaybackMode = async (clientId) => {
  const { data, error } = await supabase
    .from('clients')
    .select('playback_mode')
    .eq('id', clientId)
    .single()

  if (error) {
    console.error('Error fetching playback mode:', error)
    return 'independent'
  }
  return data?.playback_mode || 'independent'
}

/**
 * Actualizar el modo de reproducción de una cuenta
 */
export const updateClientPlaybackMode = async (clientId, playbackMode) => {
  const { error } = await supabase
    .from('clients')
    .update({ playback_mode: playbackMode })
    .eq('id', clientId)

  if (error) {
    console.error('Error updating playback mode:', error)
    throw error
  }
}

/**
 * Obtener o crear sesión de reproducción para una cuenta
 */
export const ensurePlaybackSession = async (clientId) => {
  // Intentar obtener sesión existente
  const { data: existing } = await supabase
    .from('playback_sessions')
    .select('*')
    .eq('client_id', clientId)
    .single()

  if (existing) return existing

  // Crear nueva sesión si no existe
  const { data, error } = await supabase
    .from('playback_sessions')
    .insert({
      client_id: clientId,
      playback_state: 'stopped',
      is_centralized: false
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating playback session:', error)
    throw error
  }
  return data
}

/**
 * Obtener la sesión de reproducción actual de una cuenta
 */
export const getPlaybackSessionByClient = async (clientId) => {
  const { data, error } = await supabase
    .from('playback_sessions')
    .select(`
      *,
      songs (*),
      playlists (*),
      controller:controlled_by (
        id,
        full_name
      )
    `)
    .eq('client_id', clientId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching playback session:', error)
    throw error
  }
  return data
}

/**
 * Broadcast estado de reproducción (para modo sincronizado)
 */
export const broadcastPlaybackState = async (clientId, updates) => {
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('playback_sessions')
    .update({
      ...updates,
      controlled_by: user?.id,
      sequence_number: Date.now(),
      updated_at: new Date().toISOString()
    })
    .eq('client_id', clientId)

  if (error) {
    console.error('Error broadcasting playback state:', error)
    throw error
  }
}

/**
 * Tomar control de la reproducción sincronizada
 */
export const takePlaybackControl = async (clientId) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { error } = await supabase
    .from('playback_sessions')
    .update({
      controlled_by: user.id,
      controller_heartbeat: new Date().toISOString(),
      is_centralized: true,
      sequence_number: Date.now()
    })
    .eq('client_id', clientId)

  if (error) {
    console.error('Error taking control:', error)
    throw error
  }
}

/**
 * Soltar control de la reproducción sincronizada
 */
export const releasePlaybackControl = async (clientId) => {
  const { error } = await supabase
    .from('playback_sessions')
    .update({
      controlled_by: null,
      is_centralized: false
    })
    .eq('client_id', clientId)

  if (error) {
    console.error('Error releasing control:', error)
    throw error
  }
}

/**
 * Suscribirse a cambios en la sesión de reproducción (mejorada)
 */
export const subscribeToPlaybackSessionEnhanced = (clientId, callback) => {
  return supabase
    .channel(`playback-sync-${clientId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'playback_sessions',
        filter: `client_id=eq.${clientId}`
      },
      (payload) => {
        callback(payload.new, payload.old, payload.eventType)
      }
    )
    .subscribe()
}

/**
 * Verificar si el usuario actual puede controlar la reproducción de una cuenta
 * Ahora también verifica si es el owner de la cuenta
 */
export const canControlPlayback = async (clientId) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  // Check if user is the account owner (if owner_id column exists)
  try {
    const { data: clientData } = await supabase
      .from('clients')
      .select('owner_id')
      .eq('id', clientId)
      .single()

    if (clientData?.owner_id === user.id) return true
  } catch {
    // owner_id column may not exist yet, continue with other checks
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role, access_level, client_id')
    .eq('id', user.id)
    .single()

  if (error || !data) return false

  // Platform admins can control any account
  if (data.role === 'admin') return true

  // Account managers can control their own account
  if (data.role === 'manager' && data.access_level === 'account' && data.client_id === clientId) {
    return true
  }

  return false
}

// ================================================
// OWNER/MANAGER MANAGEMENT
// ================================================

/**
 * Obtener usuarios disponibles para ser owner/manager
 * Solo usuarios activos con rol manager o admin
 */
export const getUsersForOwnerSelection = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, role')
    .eq('is_active', true)
    .in('role', ['manager', 'admin'])
    .order('full_name')

  if (error) {
    console.error('Error fetching users for selection:', error)
    throw error
  }
  return data
}

/**
 * Obtener todos los usuarios activos (para manager de local)
 */
export const getActiveUsers = async () => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, role')
    .eq('is_active', true)
    .order('full_name')

  if (error) {
    console.error('Error fetching active users:', error)
    throw error
  }
  return data
}

/**
 * Obtener cuentas con información del owner
 */
export const getAllAccountsWithOwner = async () => {
  // Try with owner first, fallback to basic query if column doesn't exist
  const { data, error } = await supabase
    .from('clients')
    .select(`
      *,
      locations (id),
      owner:owner_id (
        id,
        full_name,
        email
      )
    `)
    .order('name')

  if (error) {
    // Fallback to basic query if owner_id column doesn't exist yet
    console.warn('Falling back to basic accounts query:', error.message)
    const { data: basicData, error: basicError } = await supabase
      .from('clients')
      .select(`
        *,
        locations (id)
      `)
      .order('name')

    if (basicError) {
      console.error('Error fetching accounts:', basicError)
      throw basicError
    }

    return basicData.map(account => ({
      ...account,
      venue_count: account.locations?.length || 0,
      locations: undefined,
      owner: null
    }))
  }

  return data.map(account => ({
    ...account,
    venue_count: account.locations?.length || 0,
    locations: undefined
  }))
}

/**
 * Obtener locales con información del manager
 */
export const getAllVenuesWithManager = async () => {
  // Try with manager first, fallback to basic query if column doesn't exist
  const { data, error } = await supabase
    .from('locations')
    .select(`
      *,
      clients (
        id,
        name
      ),
      manager:manager_id (
        id,
        full_name,
        email
      )
    `)
    .order('name')

  if (error) {
    // Fallback to basic query if manager_id column doesn't exist yet
    console.warn('Falling back to basic venues query:', error.message)
    const { data: basicData, error: basicError } = await supabase
      .from('locations')
      .select(`
        *,
        clients (
          id,
          name
        )
      `)
      .order('name')

    if (basicError) {
      console.error('Error fetching venues:', basicError)
      throw basicError
    }

    return basicData.map(venue => ({
      ...venue,
      manager: null
    }))
  }
  return data
}

/**
 * Eliminar usuario (soft delete - desactivar)
 */
export const deleteUser = async (userId) => {
  const { data, error } = await supabase.rpc('delete_user_profile', {
    p_user_id: userId
  })

  if (error) {
    console.error('Error deleting user:', error)
    throw new Error(error.message || 'Error al eliminar usuario')
  }

  return data
}

/**
 * Verificar si el usuario actual es el owner de una cuenta
 */
export const isAccountOwner = async (clientId) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('clients')
    .select('owner_id')
    .eq('id', clientId)
    .single()

  return data?.owner_id === user.id
}

// ================================================
// PASSWORD RESET FUNCTIONS
// ================================================

/**
 * Solicitar reset de contraseña (envía email)
 * @param {string} email - Email del usuario
 * @returns {Promise<Object>} Resultado de la solicitud
 */
export const requestPasswordReset = async (email) => {
  try {
    // Llamar a la función SQL
    const { data, error } = await supabase
      .rpc('request_password_reset', {
        user_email: email
      })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error requesting password reset:', error)
    throw error
  }
}

/**
 * Validar token de reset de contraseña
 * @param {string} token - Token del reset
 * @returns {Promise<boolean>} True si el token es válido
 */
export const validateResetToken = async (token) => {
  try {
    const { data, error } = await supabase
      .rpc('validate_reset_token', {
        reset_token: token
      })

    if (error) throw error
    return data !== null
  } catch (error) {
    console.error('Error validating reset token:', error)
    return false
  }
}

/**
 * Completar el reset de contraseña
 * @param {string} token - Token del reset
 * @param {string} newPassword - Nueva contraseña
 * @returns {Promise<Object>} Resultado del reset
 */
export const completePasswordReset = async (token, newPassword) => {
  try {
    const { data, error } = await supabase
      .rpc('complete_password_reset', {
        reset_token: token,
        new_password: newPassword
      })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error completing password reset:', error)
    throw error
  }
}

// ================================================
// PLAYLIST ASSIGNMENTS
// ================================================

/**
 * Get playlists assigned to an account
 */
export const getAccountPlaylists = async (clientId) => {
  const { data, error } = await supabase
    .rpc('get_account_playlists', { p_client_id: clientId })

  if (error) throw error
  return data
}

/**
 * Get playlists assigned to a location
 */
export const getLocationPlaylists = async (locationId) => {
  const { data, error } = await supabase
    .rpc('get_location_playlists', { p_location_id: locationId })

  if (error) throw error
  return data
}

/**
 * Get available playlists for a location (from account, not yet assigned)
 */
export const getAvailablePlaylistsForLocation = async (locationId) => {
  const { data, error } = await supabase
    .rpc('get_available_playlists_for_location', { p_location_id: locationId })

  if (error) throw error
  return data
}

/**
 * Assign playlist to an account
 */
export const assignPlaylistToAccount = async (clientId, playlistId) => {
  const { data, error } = await supabase
    .rpc('assign_playlist_to_account', {
      p_client_id: clientId,
      p_playlist_id: playlistId
    })

  if (error) throw error
  return data
}

/**
 * Remove playlist from an account
 */
export const removePlaylistFromAccount = async (clientId, playlistId) => {
  const { data, error } = await supabase
    .rpc('remove_playlist_from_account', {
      p_client_id: clientId,
      p_playlist_id: playlistId
    })

  if (error) throw error
  return data
}

/**
 * Assign playlist to a location
 */
export const assignPlaylistToLocation = async (locationId, playlistId) => {
  const { data, error } = await supabase
    .rpc('assign_playlist_to_location', {
      p_location_id: locationId,
      p_playlist_id: playlistId
    })

  if (error) throw error
  return data
}

/**
 * Remove playlist from a location
 */
export const removePlaylistFromLocation = async (locationId, playlistId) => {
  const { data, error } = await supabase
    .rpc('remove_playlist_from_location', {
      p_location_id: locationId,
      p_playlist_id: playlistId
    })

  if (error) throw error
  return data
}

/**
 * Get all playlists (for assignment selection)
 */
export const getAllPlaylistsForAssignment = async () => {
  const { data, error } = await supabase
    .from('playlists')
    .select('id, name, description, is_public, cover_image_url')
    .order('name')

  if (error) throw error
  return data
}