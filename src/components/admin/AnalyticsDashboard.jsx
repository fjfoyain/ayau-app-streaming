export { default } from './AnalyticsDashboardV2';
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({
    overview: null,
    topSongs: [],
    topUsers: [],
    byDay: [],
    byHour: [],
    weeklyTrends: [],
    monthlyTrends: [],
    byClient: [],
    byLocation: [],
    excludedUsers: [],
  });
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

  const fetchEnhancedAnalytics = async () => {
    try {
      // Overview
      const { data: overview } = await supabase
        .from('analytics_overview')
        .select('*')
        .single();

      // Top Canciones
      const { data: topSongs } = await supabase
        .from('analytics_top_songs')
        .select('*')
        .limit(10);

      // Top Usuarios
      const { data: topUsers } = await supabase
        .from('analytics_top_users')
        .select('*')
        .limit(10);

      // Por Día
      const { data: byDay } = await supabase
        .from('analytics_by_day')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(30);

      // Tendencias Mensuales
      const { data: monthlyTrends } = await supabase
        .from('analytics_monthly_trends')
        .select('*')
        .order('mes', { ascending: false });

      // Por Ubicación
      const { data: byLocation } = await supabase
        .from('analytics_by_location')
        .select('*')
        .order('reproducciones', { ascending: false });

      // Por Cliente
      const { data: byClient } = await supabase
        .from('analytics_by_client')
        .select('*')
        .order('reproducciones', { ascending: false });

      // Usuarios Excluidos (IMPORTANTE PARA REGALÍAS)
      const { data: excludedUsers } = await supabase
        .from('excluded_analytics_users')
        .select('*');

      setAnalyticsData({
        overview,
        topSongs: topSongs || [],
        topUsers: topUsers || [],
        byDay: (byDay || []).reverse(),
        byHour: [],
        weeklyTrends: [],
        monthlyTrends: monthlyTrends || [],
        byClient: byClient || [],
        byLocation: byLocation || [],
        excludedUsers: excludedUsers || [],
      });
    } catch (error) {
      console.error('Error fetching enhanced analytics:', error);
    }
  };

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

  const handleExportCSV = async (format) => {
    try {
      const { data: csvData } = await supabase.rpc('export_analytics_csv', {
        p_format: format,
      });

      const element = document.createElement('a');
      const file = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      element.href = URL.createObjectURL(file);
      element.download = `analytics-${format}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Error exporting CSV: ' + error.message);
    }
  };

  const handleExportJSON = async () => {
    try {
      const { data: jsonData } = await supabase.rpc('export_analytics_json', {
        p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        p_end_date: new Date().toISOString().split('T')[0],
        p_format: 'summary',
      });

      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(jsonData.data, null, 2)], {
        type: 'application/json',
      });
      element.href = URL.createObjectURL(file);
      element.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Error exporting JSON: ' + error.message);
    }
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

      {/* Export Buttons */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Button
          startIcon={<FileDownloadIcon />}
          onClick={() => handleExportCSV('daily')}
          variant="outlined"
          size="small"
          sx={{
            borderColor: '#F4D03F',
            color: '#F4D03F',
            '&:hover': {
              backgroundColor: '#F4D03F20',
            },
          }}
        >
          CSV Daily
        </Button>
        <Button
          startIcon={<FileDownloadIcon />}
          onClick={() => handleExportCSV('songs')}
          variant="outlined"
          size="small"
          sx={{
            borderColor: '#F4D03F',
            color: '#F4D03F',
            '&:hover': {
              backgroundColor: '#F4D03F20',
            },
          }}
        >
          CSV Canciones
        </Button>
        <Button
          startIcon={<FileDownloadIcon />}
          onClick={() => handleExportCSV('locations')}
          variant="outlined"
          size="small"
          sx={{
            borderColor: '#F4D03F',
            color: '#F4D03F',
            '&:hover': {
              backgroundColor: '#F4D03F20',
            },
          }}
        >
          CSV Locales
        </Button>
        <Button
          startIcon={<FileDownloadIcon />}
          onClick={handleExportJSON}
          variant="outlined"
          size="small"
          sx={{
            borderColor: '#F4D03F',
            color: '#F4D03F',
            '&:hover': {
              backgroundColor: '#F4D03F20',
            },
          }}
        >
          JSON
        </Button>
      </Box>

      {/* Alerta Usuarios Excluidos */}
      {analyticsData.excludedUsers && analyticsData.excludedUsers.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3, backgroundColor: '#FF980020' }}>
          <strong>⚠️ {analyticsData.excludedUsers.length} usuario(s) excluido(s) de analytics:</strong>{' '}
          {analyticsData.excludedUsers.map((u) => u.email).join(', ')}
        </Alert>
      )}

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

      {/* Tabs for Enhanced Analytics */}
      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        sx={{
          borderBottom: '2px solid #F4D03F',
          mb: 3,
          '& .MuiTab-root': {
            color: '#999',
            '&.Mui-selected': {
              color: '#F4D03F',
            },
          },
        }}
      >
        <Tab label="📋 Resumen Clásico" />
        <Tab label="🎵 Top Canciones" />
        <Tab label="👥 Top Usuarios" />
        <Tab label="📈 Tendencias Diarias" />
        <Tab label="📊 Tendencias Mensuales" />
        <Tab label="🏢 Por Ubicación" />
        <Tab label="🏭 Por Cuenta" />
        <Tab label="⚠️ Excluidos (Regalías)" />
      </Tabs>

      {/* Tab 0: Classic Summary */}
      {tabValue === 0 && (
        <>
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
        </>
      )}

      {/* Tab 1: Top Songs */}
      {tabValue === 1 && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: '#222' }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                  Gráfico: Top 10 Canciones Reproducidas
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analyticsData.topSongs}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                      dataKey="song_title"
                      tick={{ fill: '#999', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis tick={{ fill: '#999' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#333',
                        border: '1px solid #F4D03F',
                      }}
                    />
                    <Bar dataKey="reproducciones" fill="#F4D03F" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ backgroundColor: '#222' }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                  Tabla Detallada
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#333' }}>
                        <TableCell sx={{ color: '#F4D03F' }}>Canción</TableCell>
                        <TableCell sx={{ color: '#F4D03F' }}>Artista</TableCell>
                        <TableCell sx={{ color: '#F4D03F' }} align="right">
                          Reproducciones
                        </TableCell>
                        <TableCell sx={{ color: '#F4D03F' }} align="right">
                          Usuarios
                        </TableCell>
                        <TableCell sx={{ color: '#F4D03F' }} align="right">
                          Horas
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analyticsData.topSongs.map((song, idx) => (
                        <TableRow key={song.song_id} sx={{ borderBottom: '1px solid #333' }}>
                          <TableCell sx={{ color: '#fff' }}>
                            {idx + 1}. {song.song_title}
                          </TableCell>
                          <TableCell sx={{ color: '#999' }}>{song.performer}</TableCell>
                          <TableCell sx={{ color: '#F4D03F' }} align="right">
                            {song.reproducciones}
                          </TableCell>
                          <TableCell sx={{ color: '#999' }} align="right">
                            {song.usuarios_unicos}
                          </TableCell>
                          <TableCell sx={{ color: '#999' }} align="right">
                            {song.horas_reproducidas}h
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab 2: Top Users */}
      {tabValue === 2 && (
        <Card sx={{ backgroundColor: '#222' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
              Top 10 Usuarios Más Activos
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#333' }}>
                    <TableCell sx={{ color: '#F4D03F' }}>Usuario</TableCell>
                    <TableCell sx={{ color: '#F4D03F' }} align="right">
                      Reproducciones
                    </TableCell>
                    <TableCell sx={{ color: '#F4D03F' }} align="right">
                      Canciones Únicas
                    </TableCell>
                    <TableCell sx={{ color: '#F4D03F' }} align="right">
                      Horas
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analyticsData.topUsers.map((user, idx) => (
                    <TableRow key={user.user_id} sx={{ borderBottom: '1px solid #333' }}>
                      <TableCell sx={{ color: '#fff' }}>
                        {idx + 1}. {user.user_name}
                      </TableCell>
                      <TableCell sx={{ color: '#F4D03F' }} align="right">
                        {user.reproducciones}
                      </TableCell>
                      <TableCell sx={{ color: '#999' }} align="right">
                        {user.canciones_unicas}
                      </TableCell>
                      <TableCell sx={{ color: '#999' }} align="right">
                        {user.horas_reproducidas}h
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Daily Trends */}
      {tabValue === 3 && (
        <Card sx={{ backgroundColor: '#222' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
              Tendencias Diarias (Últimos 30 Días)
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={analyticsData.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="fecha" tick={{ fill: '#999', fontSize: 12 }} />
                <YAxis tick={{ fill: '#999' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#333',
                    border: '1px solid #F4D03F',
                  }}
                />
                <Legend wrapperStyle={{ color: '#999' }} />
                <Line
                  type="monotone"
                  dataKey="reproducciones"
                  stroke="#F4D03F"
                  dot={false}
                  name="Reproducciones"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Monthly Trends */}
      {tabValue === 4 && (
        <Card sx={{ backgroundColor: '#222' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
              Tendencias Mensuales (Últimos 12 Meses)
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={analyticsData.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis
                  dataKey="mes_nombre"
                  tick={{ fill: '#999', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis tick={{ fill: '#999' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#333',
                    border: '1px solid #F4D03F',
                  }}
                />
                <Legend wrapperStyle={{ color: '#999' }} />
                <Bar dataKey="reproducciones" fill="#F4D03F" name="Reproducciones" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: By Location */}
      {tabValue === 5 && (
        <Card sx={{ backgroundColor: '#222' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
              Reproducciones por Ubicación/Local
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#333' }}>
                    <TableCell sx={{ color: '#F4D03F' }}>Ubicación</TableCell>
                    <TableCell sx={{ color: '#F4D03F' }}>Cuenta</TableCell>
                    <TableCell sx={{ color: '#F4D03F' }} align="right">
                      Reproducciones
                    </TableCell>
                    <TableCell sx={{ color: '#F4D03F' }} align="right">
                      Usuarios
                    </TableCell>
                    <TableCell sx={{ color: '#F4D03F' }} align="right">
                      Horas
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analyticsData.byLocation.map((loc) => (
                    <TableRow key={loc.location_id} sx={{ borderBottom: '1px solid #333' }}>
                      <TableCell sx={{ color: '#fff' }}>{loc.location_name}</TableCell>
                      <TableCell sx={{ color: '#999' }}>{loc.client_name}</TableCell>
                      <TableCell sx={{ color: '#F4D03F' }} align="right">
                        {loc.reproducciones}
                      </TableCell>
                      <TableCell sx={{ color: '#999' }} align="right">
                        {loc.usuarios_unicos}
                      </TableCell>
                      <TableCell sx={{ color: '#999' }} align="right">
                        {loc.horas_reproducidas}h
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 6: By Client */}
      {tabValue === 6 && (
        <Card sx={{ backgroundColor: '#222' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
              Reproducciones por Cuenta/Cliente
            </Typography>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={analyticsData.byClient}
                  dataKey="reproducciones"
                  nameKey="client_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label
                >
                  {analyticsData.byClient.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#F4D03F', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#333',
                    border: '1px solid #F4D03F',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab 7: Excluded Users (CRITICAL) */}
      {tabValue === 7 && (
        <Card sx={{ backgroundColor: '#222', borderLeft: '4px solid #FF9800' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#FF9800', mb: 2 }}>
              ⚠️ Usuarios Excluidos de Analytics y Regalías
            </Typography>
            {analyticsData.excludedUsers && analyticsData.excludedUsers.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#333' }}>
                      <TableCell sx={{ color: '#FF9800' }}>Email</TableCell>
                      <TableCell sx={{ color: '#FF9800' }}>Nombre</TableCell>
                      <TableCell sx={{ color: '#FF9800' }}>Rol</TableCell>
                      <TableCell sx={{ color: '#FF9800' }}>Razón</TableCell>
                      <TableCell sx={{ color: '#FF9800' }} align="right">
                        Total Plays (No Contadas)
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyticsData.excludedUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        sx={{
                          borderBottom: '1px solid #333',
                          backgroundColor: '#2a0000',
                        }}
                      >
                        <TableCell sx={{ color: '#fff' }}>{user.email}</TableCell>
                        <TableCell sx={{ color: '#999' }}>{user.full_name}</TableCell>
                        <TableCell sx={{ color: '#999' }}>
                          <Chip label={user.role} size="small" />
                        </TableCell>
                        <TableCell sx={{ color: '#FF9800' }}>
                          <strong>{user.exclude_reason || 'Sin especificar'}</strong>
                        </TableCell>
                        <TableCell sx={{ color: '#FF9800' }} align="right">
                          {user.total_plays || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="success">✓ No hay usuarios excluidos</Alert>
            )}
            <Typography variant="caption" sx={{ color: '#999', mt: 2, display: 'block' }}>
              <strong>Nota:</strong> Los usuarios excluidos no contarán en los cálculos de regalías ni en los analytics.
            </Typography>
          </CardContent>
        </Card>
      )}

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
          precisos de uso para derechos de autor. Los usuarios excluidos no serán contados.
        </Typography>
      </Paper>
    </Box>
  );
}

const Card = ({ children, sx }) => (
  <Paper
    sx={{
      p: 3,
      backgroundColor: '#222',
      border: '2px solid #F4D03F44',
      borderRadius: '16px',
      ...sx,
    }}
  >
    {children}
  </Paper>
);
