import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Probar conexión a Supabase
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.from('playlists').select('count')
        if (error) throw error
        setConnected(true)
      } catch (error) {
        console.error('Error connecting to Supabase:', error)
        setConnected(false)
      } finally {
        setLoading(false)
      }
    }

    testConnection()
  }, [])

  if (loading) {
    return (
      <div className="app">
        <h1>AYAU Music Streaming</h1>
        <p>Conectando a Supabase...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <h1>🎵 AYAU Music Streaming</h1>

      <div className="status">
        <h2>Estado de Conexión</h2>
        {connected ? (
          <p className="success">✅ Conectado a Supabase correctamente</p>
        ) : (
          <p className="error">❌ Error al conectar con Supabase</p>
        )}
      </div>

      <div className="info">
        <h2>Proyecto Configurado</h2>
        <ul>
          <li>✅ React 19 + Vite</li>
          <li>✅ Supabase Client</li>
          <li>✅ Variables de entorno</li>
          <li>✅ Schema de base de datos</li>
          <li>✅ Servicios de API</li>
        </ul>
      </div>

      <div className="next-steps">
        <h2>Próximos Pasos</h2>
        <ol>
          <li>Configurar Cloudflare R2 para audio</li>
          <li>Crear Admin Panel</li>
          <li>Actualizar Frontend con Auth</li>
          <li>Implementar tracking de reproducción</li>
        </ol>
      </div>
    </div>
  )
}

export default App
