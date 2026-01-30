import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PeopleIcon from '@mui/icons-material/People';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    playlists: 0,
    songs: 0,
    users: 0,
    plays: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [playlistsRes, songsRes, usersRes, playsRes] = await Promise.all([
        supabase.from('playlists').select('id', { count: 'exact', head: true }),
        supabase.from('songs').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('play_history').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        playlists: playlistsRes.count || 0,
        songs: songsRes.count || 0,
        users: usersRes.count || 0,
        plays: playsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Playlists', value: stats.playlists, icon: <QueueMusicIcon sx={{ fontSize: 48 }} />, color: '#F4D03F' },
    { title: 'Canciones', value: stats.songs, icon: <MusicNoteIcon sx={{ fontSize: 48 }} />, color: '#F4D03F' },
    { title: 'Usuarios', value: stats.users, icon: <PeopleIcon sx={{ fontSize: 48 }} />, color: '#F4D03F' },
    { title: 'Reproducciones', value: stats.plays, icon: <PlayCircleOutlineIcon sx={{ fontSize: 48 }} />, color: '#F4D03F' },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress sx={{ color: '#F4D03F' }} size={60} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h3" sx={{ color: '#F4D03F', fontWeight: 'bold', mb: 4 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <Paper
              sx={{
                p: 3,
                backgroundColor: '#000',
                border: '2px solid #F4D03F',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.3s',
                '&:hover': {
                  backgroundColor: '#F4D03F11',
                  boxShadow: '0 0 20px rgba(244, 208, 63, 0.3)',
                },
              }}
            >
              <Box sx={{ color: card.color }}>{card.icon}</Box>
              <Typography variant="h4" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
                {card.value}
              </Typography>
              <Typography variant="body1" sx={{ color: '#F4D03F99', textAlign: 'center' }}>
                {card.title}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" sx={{ color: '#F4D03F', fontWeight: 'bold', mb: 3 }}>
          Bienvenido al Panel de Administración
        </Typography>
        <Paper
          sx={{
            p: 4,
            backgroundColor: '#000',
            border: '2px solid #F4D03F44',
            borderRadius: '16px',
          }}
        >
          <Typography sx={{ color: '#F4D03F99', lineHeight: 1.8 }}>
            Desde aquí puedes gestionar todas las playlists, canciones y usuarios de la plataforma AYAU.
            <br /><br />
            Usa el menú lateral para navegar entre las diferentes secciones:
            <ul style={{ marginTop: '16px', paddingLeft: '24px' }}>
              <li><strong style={{ color: '#F4D03F' }}>Playlists:</strong> Crear, editar y eliminar playlists</li>
              <li><strong style={{ color: '#F4D03F' }}>Canciones:</strong> Gestionar el catálogo de música</li>
              <li><strong style={{ color: '#F4D03F' }}>Usuarios:</strong> Administrar usuarios y sus permisos</li>
              <li><strong style={{ color: '#F4D03F' }}>Analytics:</strong> Ver estadísticas de reproducción</li>
            </ul>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
