import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import SearchIcon from '@mui/icons-material/Search';
import { getPlayStats } from '../../services/supabase-api';

export default function AnalyticsDashboard() {
  const [playHistory, setPlayHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
  });
  const [stats, setStats] = useState({
    totalPlays: 0,
    totalSeconds: 0,
    uniqueSongs: 0,
  });

  useEffect(() => {
    fetchPlayHistory();
  }, []);

  const fetchPlayHistory = async (customFilters = {}) => {
    setLoading(true);
    try {
      const data = await getPlayStats(customFilters);
      setPlayHistory(data);

      // Calculate stats
      const totalPlays = data.length;
      const totalSeconds = data.reduce((sum, play) => sum + (play.stream_duration || 0), 0);
      const uniqueSongs = new Set(data.map(play => play.song_id)).size;

      setStats({
        totalPlays,
        totalSeconds,
        uniqueSongs,
      });
    } catch (error) {
      console.error('Error fetching play history:', error);
      setPlayHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const filterObj = {};
    if (filters.startDate) {
      filterObj.startDate = new Date(filters.startDate).toISOString();
    }
    if (filters.endDate) {
      filterObj.endDate = new Date(filters.endDate).toISOString();
    }
    fetchPlayHistory(filterObj);
  };

  const handleClearFilters = () => {
    setFilters({ startDate: '', endDate: '' });
    fetchPlayHistory();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-GT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

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
        Analytics & Reportes
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: '#000',
              border: '2px solid #F4D03F',
              borderRadius: '16px',
            }}
          >
            <Typography variant="h6" sx={{ color: '#F4D03F99', mb: 1 }}>
              Total de Reproducciones
            </Typography>
            <Typography variant="h3" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
              {stats.totalPlays.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: '#000',
              border: '2px solid #F4D03F',
              borderRadius: '16px',
            }}
          >
            <Typography variant="h6" sx={{ color: '#F4D03F99', mb: 1 }}>
              Tiempo Total Reproducido
            </Typography>
            <Typography variant="h3" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
              {formatTotalTime(stats.totalSeconds)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: '#000',
              border: '2px solid #F4D03F',
              borderRadius: '16px',
            }}
          >
            <Typography variant="h6" sx={{ color: '#F4D03F99', mb: 1 }}>
              Canciones Únicas
            </Typography>
            <Typography variant="h3" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
              {stats.uniqueSongs}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          backgroundColor: '#000',
          border: '2px solid #F4D03F44',
          borderRadius: '16px',
        }}
      >
        <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
          Filtros
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Fecha Inicio"
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#F4D03F',
                '& fieldset': { borderColor: '#F4D03F44' },
                '&:hover fieldset': { borderColor: '#F4D03F' },
                '&.Mui-focused fieldset': { borderColor: '#F4D03F' },
              },
              '& .MuiInputLabel-root': { color: '#F4D03F99' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#F4D03F' },
            }}
          />
          <TextField
            label="Fecha Fin"
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#F4D03F',
                '& fieldset': { borderColor: '#F4D03F44' },
                '&:hover fieldset': { borderColor: '#F4D03F' },
                '&.Mui-focused fieldset': { borderColor: '#F4D03F' },
              },
              '& .MuiInputLabel-root': { color: '#F4D03F99' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#F4D03F' },
            }}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#F4D03Fdd' },
            }}
          >
            Buscar
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearFilters}
            sx={{
              color: '#F4D03F',
              borderColor: '#F4D03F44',
              '&:hover': {
                borderColor: '#F4D03F',
                backgroundColor: '#F4D03F11',
              },
            }}
          >
            Limpiar
          </Button>
        </Box>
      </Paper>

      {/* Play History Table */}
      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: '#000',
          border: '2px solid #F4D03F',
          borderRadius: '16px',
          maxHeight: 600,
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ backgroundColor: '#000', color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                Fecha
              </TableCell>
              <TableCell sx={{ backgroundColor: '#000', color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                Canción
              </TableCell>
              <TableCell sx={{ backgroundColor: '#000', color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                Artista
              </TableCell>
              <TableCell sx={{ backgroundColor: '#000', color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                Usuario
              </TableCell>
              <TableCell sx={{ backgroundColor: '#000', color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                Playlist
              </TableCell>
              <TableCell sx={{ backgroundColor: '#000', color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }} align="center">
                Duración
              </TableCell>
              <TableCell sx={{ backgroundColor: '#000', color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }} align="center">
                País
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {playHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: '#F4D03F66', py: 4 }}>
                  No hay datos de reproducción disponibles
                </TableCell>
              </TableRow>
            ) : (
              playHistory.map((play, index) => (
                <TableRow
                  key={play.id || index}
                  sx={{
                    '&:hover': { backgroundColor: '#F4D03F11' },
                    borderBottom: '1px solid #F4D03F22',
                  }}
                >
                  <TableCell sx={{ color: '#F4D03F99' }}>
                    {formatDate(play.played_at)}
                  </TableCell>
                  <TableCell sx={{ color: '#F4D03F' }}>
                    {play.songs?.title || 'Desconocido'}
                  </TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>
                    {play.songs?.performer || '-'}
                  </TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>
                    {play.user_profiles?.full_name || 'Usuario desconocido'}
                  </TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>
                    {play.playlists?.name || '-'}
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#F4D03F99' }}>
                    {formatDuration(play.stream_duration)}
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#F4D03F99', fontFamily: 'monospace' }}>
                    {play.country_code}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Info Note */}
      <Paper
        sx={{
          p: 3,
          mt: 3,
          backgroundColor: '#000',
          border: '2px solid #F4D03F44',
          borderRadius: '16px',
        }}
      >
        <Typography variant="body2" sx={{ color: '#F4D03F99' }}>
          <strong style={{ color: '#F4D03F' }}>Nota:</strong> Esta información es útil para el cálculo de royalties.
          Cada reproducción registra el tiempo exacto que el usuario escuchó la canción, permitiendo reportes
          precisos de uso para derechos de autor.
        </Typography>
      </Paper>
    </Box>
  );
}
