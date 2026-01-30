import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jdeugfhserkiunbsdozx.supabase.co'
const supabaseAnonKey = 'sb_publishable_HZrc6ETRPuUvwO0QlUxBwQ_9heO4zFv'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('🔍 Probando conexión a Supabase...\n')

  // Test 1: Verificar si la tabla playlists existe
  console.log('1. Verificando tabla playlists...')
  const { data: playlists, error: playlistsError } = await supabase
    .from('playlists')
    .select('*')
    .limit(5)

  if (playlistsError) {
    console.log('❌ Error en playlists:', playlistsError.message)
    console.log('   Código:', playlistsError.code)
  } else {
    console.log(`✅ Tabla playlists existe. Registros: ${playlists.length}`)
    if (playlists.length > 0) {
      console.log('   Ejemplo:', playlists[0])
    }
  }

  // Test 2: Verificar si la tabla songs existe
  console.log('\n2. Verificando tabla songs...')
  const { data: songs, error: songsError } = await supabase
    .from('songs')
    .select('*')
    .limit(5)

  if (songsError) {
    console.log('❌ Error en songs:', songsError.message)
    console.log('   Código:', songsError.code)
  } else {
    console.log(`✅ Tabla songs existe. Registros: ${songs.length}`)
  }

  // Test 3: Verificar si la tabla play_history existe
  console.log('\n3. Verificando tabla play_history...')
  const { data: plays, error: playsError } = await supabase
    .from('play_history')
    .select('*')
    .limit(5)

  if (playsError) {
    console.log('❌ Error en play_history:', playsError.message)
    console.log('   Código:', playsError.code)
  } else {
    console.log(`✅ Tabla play_history existe. Registros: ${plays.length}`)
  }

  // Test 4: Verificar tabla users
  console.log('\n4. Verificando tabla users...')
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .limit(5)

  if (usersError) {
    console.log('❌ Error en users:', usersError.message)
  } else {
    console.log(`✅ Tabla users existe. Registros: ${users.length}`)
  }

  console.log('\n✅ Test de conexión completado')
}

testConnection().catch(console.error)
