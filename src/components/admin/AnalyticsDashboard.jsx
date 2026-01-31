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
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  getPlayStats,
  getAllAccounts,
  getVenuesForAccount,
  getAnalyticsByAccount,
  getAnalyticsByVenue,
} from '../../services/supabase-api';

export default function AnalyticsDashboard() {
  const [playHistory, setPlayHistory] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [venues, setVenues] = useState([]);
  const [accountBreakdown, setAccountBreakdown] = useState([]);
  const [venueBreakdown, setVenueBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    accountId: '',
    venueId: '',
  });
  const [stats, setStats] = useState({
    totalPlays: 0,
    totalSeconds: 0,
    uniqueSongs: 0,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (filters.accountId) {
      fetchVenuesForSelectedAccount();
      fetchAccountBreakdown();
    } else {
      setVenues([]);
      setVenueBreakdown([]);
      setFilters(prev => ({ ...prev, venueId: '' }));
    }
  }, [filters.accountId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [accountsData] = await Promise.all([
        getAllAccounts(),
        fetchPlayHistory(),
      ]);
      setAccounts(accountsData || []);
      fetchGlobalAccountBreakdown();
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
    setLoading(false);
  };

  const fetchVenuesForSelectedAccount = async () => {
    try {
      const venuesData = await getVenuesForAccount(filters.accountId);
      setVenues(venuesData || []);
    } catch (error) {
      console.error('Error fetching venues:', error);
    }
  };

  const fetchGlobalAccountBreakdown = async () => {
    try {
      const data = await getAnalyticsByAccount();
      setAccountBreakdown(data || []);
    } catch (error) {
      console.error('Error fetching account breakdown:', error);
    }
  };

  const fetchAccountBreakdown = async () => {
    if (!filters.accountId) return;
    try {
      const data = await getAnalyticsByVenue(filters.accountId);
      setVenueBreakdown(data || []);
    } catch (error) {
      console.error('Error fetching venue breakdown:', error);
    }
  };

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
    if (filters.accountId) {
      filterObj.clientId = filters.accountId;
    }
    if (filters.venueId) {
      filterObj.locationId = filters.venueId;
    }
    fetchPlayHistory(filterObj);
  };

  const handleClearFilters = () => {
    setFilters({ startDate: '', endDate: '', accountId: '', venueId: '' });
    setVenues([]);
    setVenueBreakdown([]);
    fetchPlayHistory();
    fetchGlobalAccountBreakdown();
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

  const getHeaderTitle = () => {
    let title = 'Analytics & Reportes';
    if (filters.venueId) {
      const venue = venues.find((v) => v.id === filters.venueId);
      if (venue) title += ` - ${venue.name}`;
    } else if (filters.accountId) {
      const account = accounts.find((a) => a.id === filters.accountId);
      if (account) title += ` - ${account.name}`;
    }
    return title;
  };

  return (
    <Box>
      <Typography variant="h3" sx={{ color: '#F4D03F', fontWeight: 'bold', mb: 4 }}>
        {getHeaderTitle()}
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

      {/* Account Breakdown - shown when no account filter selected */}
      {!filters.accountId && accountBreakdown.length > 0 && (
        <Accordion
          sx={{
            mb: 3,
            backgroundColor: '#000',
            border: '2px solid #F4D03F44',
            borderRadius: '16px !important',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: '#F4D03F' }} />}
            sx={{
              borderRadius: '16px',
              '&:hover': { backgroundColor: '#F4D03F11' },
            }}
          >
            <Typography variant="h6" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
              Desglose por Cuenta
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                      Cuenta
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                      # Locales
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                      Total Reproducciones
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                      Tiempo Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accountBreakdown.map((account) => (
                    <TableRow
                      key={account.account_id}
                      sx={{
                        '&:hover': { backgroundColor: '#F4D03F11' },
                        borderBottom: '1px solid #F4D03F22',
                      }}
                    >
                      <TableCell sx={{ color: '#F4D03F' }}>{account.account_name}</TableCell>
                      <TableCell align="center" sx={{ color: '#F4D03F99' }}>
                        {account.total_venues || 0}
                      </TableCell>
                      <TableCell align="center" sx={{ color: '#F4D03F99' }}>
                        {(account.total_plays || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="center" sx={{ color: '#F4D03F99' }}>
                        {formatTotalTime(account.total_seconds_played || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Venue Breakdown - shown when account filter is selected */}
      {filters.accountId && venueBreakdown.length > 0 && (
        <Accordion
          defaultExpanded
          sx={{
            mb: 3,
            backgroundColor: '#000',
            border: '2px solid #F4D03F44',
            borderRadius: '16px !important',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: '#F4D03F' }} />}
            sx={{
              borderRadius: '16px',
              '&:hover': { backgroundColor: '#F4D03F11' },
            }}
          >
            <Typography variant="h6" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
              Desglose por Local
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                      Local
                    </TableCell>
                    <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                      Ciudad
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                      Total Reproducciones
                    </TableCell>
                    <TableCell align="center" sx={{ color: '#F4D03F', fontWeight: 'bold', borderBottom: '2px solid #F4D03F44' }}>
                      Tiempo Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {venueBreakdown.map((venue) => (
                    <TableRow
                      key={venue.venue_id}
                      sx={{
                        '&:hover': { backgroundColor: '#F4D03F11' },
                        borderBottom: '1px solid #F4D03F22',
                      }}
                    >
                      <TableCell sx={{ color: '#F4D03F' }}>{venue.venue_name}</TableCell>
                      <TableCell sx={{ color: '#F4D03F99' }}>{venue.city || '-'}</TableCell>
                      <TableCell align="center" sx={{ color: '#F4D03F99' }}>
                        {(venue.total_plays || 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="center" sx={{ color: '#F4D03F99' }}>
                        {formatTotalTime(venue.total_seconds_played || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

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
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                Cuenta
              </InputLabel>
              <Select
                value={filters.accountId}
                onChange={(e) => setFilters({ ...filters, accountId: e.target.value, venueId: '' })}
                sx={{
                  color: '#F4D03F',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#F4D03F44' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#F4D03F' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#F4D03F' },
                  '& .MuiSvgIcon-root': { color: '#F4D03F' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#000',
                      border: '2px solid #F4D03F',
                      '& .MuiMenuItem-root': {
                        color: '#F4D03F',
                        '&:hover': { backgroundColor: '#F4D03F22' },
                        '&.Mui-selected': { backgroundColor: '#F4D03F33' },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">
                  <em>Todas las cuentas</em>
                </MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth disabled={!filters.accountId}>
              <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                Local
              </InputLabel>
              <Select
                value={filters.venueId}
                onChange={(e) => setFilters({ ...filters, venueId: e.target.value })}
                sx={{
                  color: '#F4D03F',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#F4D03F44' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#F4D03F' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#F4D03F' },
                  '& .MuiSvgIcon-root': { color: '#F4D03F' },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#000',
                      border: '2px solid #F4D03F',
                      '& .MuiMenuItem-root': {
                        color: '#F4D03F',
                        '&:hover': { backgroundColor: '#F4D03F22' },
                        '&.Mui-selected': { backgroundColor: '#F4D03F33' },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="">
                  <em>Todos los locales</em>
                </MenuItem>
                {venues.map((venue) => (
                  <MenuItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Fecha Inicio"
              type="date"
              fullWidth
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
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Fecha Fin"
              type="date"
              fullWidth
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
          </Grid>
        </Grid>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
