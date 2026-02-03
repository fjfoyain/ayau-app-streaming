import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Tab,
  Tabs,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupIcon from '@mui/icons-material/Group';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import StorageIcon from '@mui/icons-material/Storage';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningIcon from '@mui/icons-material/Warning';
import HistoryIcon from '@mui/icons-material/History';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

// Tooltip descriptions for metrics
const METRIC_TOOLTIPS = {
  reproducciones: 'Total de reproducciones completadas (min. 30 segundos) excluyendo usuarios de prueba',
  usuarios_unicos: 'Cantidad de usuarios diferentes que han reproducido contenido',
  horas_reproducidas: 'Tiempo total de reproduccion en horas',
  canciones_reproducidas: 'Cantidad de canciones diferentes reproducidas',
  completitud: 'Porcentaje promedio de la cancion que fue escuchada',
  locales_activos: 'Cantidad de ubicaciones/locales con actividad',
  data_quality: 'Metricas de calidad de datos para detectar anomalias',
  suspicious_activity: 'Usuarios con patrones de uso inusuales (posibles bots o fraude)',
  audit_log: 'Historial de cambios en exclusiones de usuarios',
};

const AnalyticsDashboardV2 = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Date range state
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Filter state
  const [filters, setFilters] = useState({
    clientId: '',
    locationId: '',
  });

  // Data state
  const [data, setData] = useState({
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
    dataQuality: [],
    suspiciousActivity: [],
    duplicatePlays: [],
    auditLog: [],
    heatmapData: [],
    exclusionReasons: [],
  });

  // Lists for filters
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);

  // Exclusion dialog state
  const [exclusionDialog, setExclusionDialog] = useState({
    open: false,
    user: null,
    exclude: true,
    reasonCode: '',
    customReason: '',
    notes: '',
  });

  // Fetch clients and locations for filters
  useEffect(() => {
    const fetchFiltersData = async () => {
      const [{ data: clientsData }, { data: locationsData }] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('locations').select('id, name, client_id').order('name'),
      ]);
      setClients(clientsData || []);
      setLocations(locationsData || []);
    };
    fetchFiltersData();
  }, []);

  // Fetch exclusion reasons
  useEffect(() => {
    const fetchExclusionReasons = async () => {
      const { data: reasons } = await supabase
        .from('exclusion_reason_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      setData((prev) => ({ ...prev, exclusionReasons: reasons || [] }));
    };
    fetchExclusionReasons();
  }, []);

  // Main data fetch function
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[Analytics] Starting fetch...');

      // Overview with custom date range
      console.log('[Analytics] Fetching overview...');
      const { data: overviewData, error: overviewError } = await supabase.rpc('get_analytics_overview_range', {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
      });
      if (overviewError) console.error('[Analytics] Overview error:', overviewError);
      console.log('[Analytics] Overview done:', overviewData);

      const overview = overviewData?.[0] || null;

      // Top Songs with date range
      console.log('[Analytics] Fetching top songs...');
      const { data: topSongs, error: topSongsError } = await supabase.rpc('get_top_songs_range', {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
        p_limit: 10,
      });
      if (topSongsError) console.error('[Analytics] Top songs error:', topSongsError);
      console.log('[Analytics] Top songs done:', topSongs?.length);

      // Top Users
      console.log('[Analytics] Fetching top users...');
      const { data: topUsers, error: topUsersError } = await supabase
        .from('analytics_top_users')
        .select('*')
        .limit(10);
      if (topUsersError) console.error('[Analytics] Top users error:', topUsersError);
      console.log('[Analytics] Top users done:', topUsers?.length);

      // Daily data with date range
      console.log('[Analytics] Fetching by day...');
      const { data: byDay, error: byDayError } = await supabase.rpc('get_analytics_by_day_range', {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
      });
      if (byDayError) console.error('[Analytics] By day error:', byDayError);
      console.log('[Analytics] By day done:', byDay?.length);

      // Hourly data
      console.log('[Analytics] Fetching by hour...');
      const { data: byHour, error: byHourError } = await supabase
        .from('analytics_by_hour')
        .select('*')
        .order('hora', { ascending: false })
        .limit(24);
      if (byHourError) console.error('[Analytics] By hour error:', byHourError);
      console.log('[Analytics] By hour done:', byHour?.length);

      // Weekly trends
      console.log('[Analytics] Fetching weekly...');
      const { data: weeklyTrends, error: weeklyError } = await supabase
        .from('analytics_weekly_trends')
        .select('*')
        .order('semana', { ascending: false });
      if (weeklyError) console.error('[Analytics] Weekly error:', weeklyError);
      console.log('[Analytics] Weekly done:', weeklyTrends?.length);

      // Monthly trends
      console.log('[Analytics] Fetching monthly...');
      const { data: monthlyTrends, error: monthlyError } = await supabase
        .from('analytics_monthly_trends')
        .select('*')
        .order('mes', { ascending: false });
      if (monthlyError) console.error('[Analytics] Monthly error:', monthlyError);
      console.log('[Analytics] Monthly done:', monthlyTrends?.length);

      // By Client
      console.log('[Analytics] Fetching by client...');
      const { data: byClient, error: byClientError } = await supabase
        .from('analytics_by_client')
        .select('*')
        .order('reproducciones', { ascending: false });
      if (byClientError) console.error('[Analytics] By client error:', byClientError);
      console.log('[Analytics] By client done:', byClient?.length);

      // By Location
      console.log('[Analytics] Fetching by location...');
      const { data: byLocation, error: byLocationError } = await supabase
        .from('analytics_by_location')
        .select('*')
        .order('reproducciones', { ascending: false });
      if (byLocationError) console.error('[Analytics] By location error:', byLocationError);
      console.log('[Analytics] By location done:', byLocation?.length);

      // Excluded Users
      console.log('[Analytics] Fetching excluded users...');
      const { data: excludedUsers, error: excludedError } = await supabase
        .from('excluded_analytics_users')
        .select('*');
      if (excludedError) console.error('[Analytics] Excluded error:', excludedError);
      console.log('[Analytics] Excluded done:', excludedUsers?.length);

      // Data Quality
      console.log('[Analytics] Fetching data quality...');
      const { data: dataQuality, error: qualityError } = await supabase
        .from('analytics_data_quality')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(30);
      if (qualityError) console.error('[Analytics] Quality error:', qualityError);
      console.log('[Analytics] Quality done:', dataQuality?.length);

      // Suspicious Activity
      console.log('[Analytics] Fetching suspicious...');
      const { data: suspiciousActivity, error: suspiciousError } = await supabase
        .from('analytics_suspicious_activity')
        .select('*')
        .limit(50);
      if (suspiciousError) console.error('[Analytics] Suspicious error:', suspiciousError);
      console.log('[Analytics] Suspicious done:', suspiciousActivity?.length);

      // Duplicate Plays
      console.log('[Analytics] Fetching duplicates...');
      const { data: duplicatePlays, error: duplicatesError } = await supabase
        .from('analytics_duplicate_plays')
        .select('*')
        .limit(50);
      if (duplicatesError) console.error('[Analytics] Duplicates error:', duplicatesError);
      console.log('[Analytics] Duplicates done:', duplicatePlays?.length);

      // Audit Log
      console.log('[Analytics] Fetching audit log...');
      const { data: auditLog, error: auditError } = await supabase
        .from('analytics_exclusion_audit_view')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (auditError) console.error('[Analytics] Audit error:', auditError);
      console.log('[Analytics] Audit done:', auditLog?.length);

      // Heatmap data
      console.log('[Analytics] Fetching heatmap...');
      const { data: heatmapData, error: heatmapError } = await supabase.rpc('get_hourly_heatmap', {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
      });
      if (heatmapError) console.error('[Analytics] Heatmap error:', heatmapError);
      console.log('[Analytics] Heatmap done:', heatmapData?.length);

      console.log('[Analytics] All fetches done, setting data...');
      setData({
        overview,
        topSongs: topSongs || [],
        topUsers: topUsers || [],
        byDay: (byDay || []).reverse(),
        byHour: (byHour || []).reverse(),
        weeklyTrends: weeklyTrends || [],
        monthlyTrends: monthlyTrends || [],
        byClient: byClient || [],
        byLocation: byLocation || [],
        excludedUsers: excludedUsers || [],
        dataQuality: dataQuality || [],
        suspiciousActivity: suspiciousActivity || [],
        duplicatePlays: duplicatePlays || [],
        auditLog: auditLog || [],
        heatmapData: heatmapData || [],
        exclusionReasons: data.exclusionReasons,
      });
      console.log('[Analytics] Data set successfully!');
    } catch (error) {
      console.error('[Analytics] CATCH ERROR:', error);
      setSnackbar({ open: true, message: 'Error cargando analytics: ' + error.message, severity: 'error' });
    } finally {
      console.log('[Analytics] Finally block - setting loading to false');
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  // Export functions
  const handleExportCSV = async (format) => {
    try {
      const { data: csvData } = await supabase.rpc('export_analytics_csv_filtered', {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
        p_format: format,
        p_client_id: filters.clientId || null,
        p_location_id: filters.locationId || null,
      });

      const element = document.createElement('a');
      const file = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      element.href = URL.createObjectURL(file);
      element.download = `analytics-${format}-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setSnackbar({ open: true, message: 'CSV exportado exitosamente', severity: 'success' });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setSnackbar({ open: true, message: 'Error exportando CSV: ' + error.message, severity: 'error' });
    }
  };

  const handleExportJSON = async () => {
    try {
      const { data: jsonResult } = await supabase.rpc('export_analytics_filtered', {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
        p_format: 'daily',
        p_client_id: filters.clientId || null,
        p_location_id: filters.locationId || null,
      });

      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(jsonResult, null, 2)], { type: 'application/json' });
      element.href = URL.createObjectURL(file);
      element.download = `analytics-${dateRange.startDate}-to-${dateRange.endDate}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setSnackbar({ open: true, message: 'JSON exportado exitosamente', severity: 'success' });
    } catch (error) {
      console.error('Error exporting JSON:', error);
      setSnackbar({ open: true, message: 'Error exportando JSON: ' + error.message, severity: 'error' });
    }
  };

  // Handle user exclusion
  const handleOpenExclusionDialog = (user, exclude = true) => {
    setExclusionDialog({
      open: true,
      user,
      exclude,
      reasonCode: '',
      customReason: '',
      notes: '',
    });
  };

  const handleExcludeUser = async () => {
    try {
      const { error } = await supabase.rpc('toggle_user_analytics_exclusion_v2', {
        p_user_id: exclusionDialog.user.user_id || exclusionDialog.user.id,
        p_exclude: exclusionDialog.exclude,
        p_reason_code: exclusionDialog.reasonCode || null,
        p_custom_reason: exclusionDialog.customReason || null,
        p_notes: exclusionDialog.notes || null,
      });

      if (error) throw error;

      setSnackbar({
        open: true,
        message: exclusionDialog.exclude
          ? 'Usuario excluido de analytics'
          : 'Usuario incluido en analytics',
        severity: 'success',
      });
      setExclusionDialog({ ...exclusionDialog, open: false });
      fetchAnalytics();
    } catch (error) {
      console.error('Error updating user exclusion:', error);
      setSnackbar({ open: true, message: 'Error: ' + error.message, severity: 'error' });
    }
  };

  // Metric card with tooltip
  const MetricCard = ({ icon: Icon, label, value, color, tooltip }) => (
    <Card sx={{ backgroundColor: '#222', borderLeft: `4px solid ${color}` }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon sx={{ color, fontSize: 32 }} />
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography color="textSecondary" variant="caption">
                {label}
              </Typography>
              {tooltip && (
                <Tooltip title={tooltip} arrow>
                  <HelpOutlineIcon sx={{ fontSize: 14, color: '#666', cursor: 'help' }} />
                </Tooltip>
              )}
            </Box>
            <Typography variant="h5" sx={{ color }}>
              {value?.toLocaleString() || 0}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress sx={{ color: '#F4D03F' }} />
      </Box>
    );
  }

  const COLORS = ['#F4D03F', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63', '#00BCD4'];

  // Prepare heatmap data for visualization
  const processHeatmapData = () => {
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    return data.heatmapData.map((item) => ({
      ...item,
      dayName: days[item.dia_semana] || item.nombre_dia,
      value: item.reproducciones,
    }));
  };

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
          Analytics Dashboard
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton onClick={handleRefresh} disabled={refreshing} sx={{ color: '#F4D03F' }}>
            <RefreshIcon className={refreshing ? 'spin' : ''} />
          </IconButton>
        </Box>
      </Box>

      {/* Date Range & Filters */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#222', border: '1px solid #333' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              label="Fecha Inicio"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': { color: '#fff' },
                '& .MuiInputLabel-root': { color: '#999' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Fecha Fin"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': { color: '#fff' },
                '& .MuiInputLabel-root': { color: '#999' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#999' }}>Cliente</InputLabel>
              <Select
                value={filters.clientId}
                onChange={(e) => setFilters({ ...filters, clientId: e.target.value, locationId: '' })}
                label="Cliente"
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' } }}
              >
                <MenuItem value="">Todos</MenuItem>
                {clients.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#999' }}>Ubicacion</InputLabel>
              <Select
                value={filters.locationId}
                onChange={(e) => setFilters({ ...filters, locationId: e.target.value })}
                label="Ubicacion"
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' } }}
              >
                <MenuItem value="">Todas</MenuItem>
                {locations
                  .filter((l) => !filters.clientId || l.client_id === filters.clientId)
                  .map((l) => (
                    <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              onClick={handleRefresh}
              startIcon={<CalendarTodayIcon />}
              sx={{ backgroundColor: '#F4D03F', color: '#000', '&:hover': { backgroundColor: '#d4b030' } }}
              fullWidth
            >
              Aplicar
            </Button>
          </Grid>
        </Grid>

        {/* Export Buttons */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Button
            startIcon={<FileDownloadIcon />}
            onClick={() => handleExportCSV('daily')}
            variant="outlined"
            size="small"
            sx={{ borderColor: '#F4D03F', color: '#F4D03F', '&:hover': { backgroundColor: '#F4D03F20' } }}
          >
            CSV Diario
          </Button>
          <Button
            startIcon={<FileDownloadIcon />}
            onClick={() => handleExportCSV('songs')}
            variant="outlined"
            size="small"
            sx={{ borderColor: '#F4D03F', color: '#F4D03F', '&:hover': { backgroundColor: '#F4D03F20' } }}
          >
            CSV Canciones
          </Button>
          <Button
            startIcon={<FileDownloadIcon />}
            onClick={() => handleExportCSV('audit')}
            variant="outlined"
            size="small"
            sx={{ borderColor: '#FF9800', color: '#FF9800', '&:hover': { backgroundColor: '#FF980020' } }}
          >
            CSV Auditoria
          </Button>
          <Button
            startIcon={<FileDownloadIcon />}
            onClick={handleExportJSON}
            variant="outlined"
            size="small"
            sx={{ borderColor: '#4CAF50', color: '#4CAF50', '&:hover': { backgroundColor: '#4CAF5020' } }}
          >
            JSON
          </Button>
        </Box>
      </Paper>

      {/* Alerts */}
      {data.excludedUsers && data.excludedUsers.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, backgroundColor: '#FF980020' }}>
          <strong>{data.excludedUsers.length} usuario(s) excluido(s) de analytics:</strong>{' '}
          {data.excludedUsers.slice(0, 3).map((u) => u.email).join(', ')}
          {data.excludedUsers.length > 3 && ` y ${data.excludedUsers.length - 3} mas...`}
        </Alert>
      )}

      {data.suspiciousActivity && data.suspiciousActivity.length > 0 && (
        <Alert severity="error" sx={{ mb: 2, backgroundColor: '#f4433620' }}>
          <strong>{data.suspiciousActivity.length} usuario(s) con actividad sospechosa detectada.</strong>{' '}
          Revisa la pestana "Calidad de Datos" para mas detalles.
        </Alert>
      )}

      {/* Overview Cards */}
      {data.overview && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={StorageIcon}
              label="Reproducciones"
              value={data.overview.total_reproducciones}
              color="#F4D03F"
              tooltip={METRIC_TOOLTIPS.reproducciones}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={GroupIcon}
              label="Usuarios Unicos"
              value={data.overview.usuarios_unicos}
              color="#FF9800"
              tooltip={METRIC_TOOLTIPS.usuarios_unicos}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={TrendingUpIcon}
              label="Horas Reproducidas"
              value={data.overview.horas_reproducidas}
              color="#4CAF50"
              tooltip={METRIC_TOOLTIPS.horas_reproducidas}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={MusicNoteIcon}
              label="Canciones"
              value={data.overview.canciones_reproducidas}
              color="#2196F3"
              tooltip={METRIC_TOOLTIPS.canciones_reproducidas}
            />
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: '2px solid #F4D03F',
          '& .MuiTab-root': { color: '#999', '&.Mui-selected': { color: '#F4D03F' } },
        }}
      >
        <Tab label="Top Canciones" />
        <Tab label="Top Usuarios" />
        <Tab label="Tendencias" />
        <Tab label="Por Ubicacion" />
        <Tab label="Heatmap" />
        <Tab label="Calidad de Datos" />
        <Tab label="Excluidos" />
        <Tab label="Auditoria" />
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {/* Tab 0: Top Songs */}
        {tabValue === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card sx={{ backgroundColor: '#222' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                    Top 10 Canciones Reproducidas
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data.topSongs}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis
                        dataKey="song_title"
                        tick={{ fill: '#999', fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis tick={{ fill: '#999' }} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#333', border: '1px solid #F4D03F' }} />
                      <Bar dataKey="reproducciones" fill="#F4D03F" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card sx={{ backgroundColor: '#222' }}>
                <CardContent>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#333' }}>
                          <TableCell sx={{ color: '#F4D03F' }}>Cancion</TableCell>
                          <TableCell sx={{ color: '#F4D03F' }}>Artista</TableCell>
                          <TableCell sx={{ color: '#F4D03F' }} align="right">Reproducciones</TableCell>
                          <TableCell sx={{ color: '#F4D03F' }} align="right">Usuarios</TableCell>
                          <TableCell sx={{ color: '#F4D03F' }} align="right">Horas</TableCell>
                          <TableCell sx={{ color: '#F4D03F' }} align="right">Completitud %</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.topSongs.map((song, idx) => (
                          <TableRow key={song.song_id} sx={{ borderBottom: '1px solid #333' }}>
                            <TableCell sx={{ color: '#fff' }}>{idx + 1}. {song.song_title}</TableCell>
                            <TableCell sx={{ color: '#999' }}>{song.performer}</TableCell>
                            <TableCell sx={{ color: '#F4D03F' }} align="right">{song.reproducciones}</TableCell>
                            <TableCell sx={{ color: '#999' }} align="right">{song.usuarios_unicos}</TableCell>
                            <TableCell sx={{ color: '#999' }} align="right">{song.horas_reproducidas}h</TableCell>
                            <TableCell
                              sx={{ color: song.completitud_promedio_pct > 80 ? '#4CAF50' : '#FF9800' }}
                              align="right"
                            >
                              {song.completitud_promedio_pct}%
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

        {/* Tab 1: Top Users */}
        {tabValue === 1 && (
          <Card sx={{ backgroundColor: '#222' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                Top 10 Usuarios Mas Activos
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#333' }}>
                      <TableCell sx={{ color: '#F4D03F' }}>Usuario</TableCell>
                      <TableCell sx={{ color: '#F4D03F' }} align="right">Reproducciones</TableCell>
                      <TableCell sx={{ color: '#F4D03F' }} align="right">Canciones Unicas</TableCell>
                      <TableCell sx={{ color: '#F4D03F' }} align="right">Horas</TableCell>
                      <TableCell sx={{ color: '#F4D03F' }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.topUsers.map((user, idx) => (
                      <TableRow key={user.user_id} sx={{ borderBottom: '1px solid #333' }}>
                        <TableCell sx={{ color: '#fff' }}>{idx + 1}. {user.user_name}</TableCell>
                        <TableCell sx={{ color: '#F4D03F' }} align="right">{user.reproducciones}</TableCell>
                        <TableCell sx={{ color: '#999' }} align="right">{user.canciones_unicas}</TableCell>
                        <TableCell sx={{ color: '#999' }} align="right">{user.horas_reproducidas}h</TableCell>
                        <TableCell>
                          <Tooltip title="Excluir de analytics">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenExclusionDialog(user, true)}
                              sx={{ color: '#FF9800' }}
                            >
                              <PersonOffIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Trends */}
        {tabValue === 2 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card sx={{ backgroundColor: '#222' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                    Tendencias Diarias
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={data.byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="fecha" tick={{ fill: '#999', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#999' }} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#333', border: '1px solid #F4D03F' }} />
                      <Legend wrapperStyle={{ color: '#999' }} />
                      <Line type="monotone" dataKey="reproducciones" stroke="#F4D03F" dot={false} name="Reproducciones" />
                      <Line type="monotone" dataKey="usuarios_unicos" stroke="#FF9800" dot={false} name="Usuarios" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card sx={{ backgroundColor: '#222' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                    Tendencias Mensuales
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis dataKey="mes_nombre" tick={{ fill: '#999', fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
                      <YAxis tick={{ fill: '#999' }} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#333', border: '1px solid #F4D03F' }} />
                      <Legend wrapperStyle={{ color: '#999' }} />
                      <Bar dataKey="reproducciones" fill="#F4D03F" name="Reproducciones" />
                      <Bar dataKey="usuarios_unicos" fill="#FF9800" name="Usuarios" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Tab 3: By Location */}
        {tabValue === 3 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={{ backgroundColor: '#222' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                    Por Cliente
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={data.byClient}
                        dataKey="reproducciones"
                        nameKey="client_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label
                      >
                        {data.byClient.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#333', border: '1px solid #F4D03F' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ backgroundColor: '#222' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                    Por Ubicacion
                  </Typography>
                  <TableContainer sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow sx={{ '& th': { backgroundColor: '#333' } }}>
                          <TableCell sx={{ color: '#F4D03F' }}>Ubicacion</TableCell>
                          <TableCell sx={{ color: '#F4D03F' }}>Cliente</TableCell>
                          <TableCell sx={{ color: '#F4D03F' }} align="right">Reproducciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.byLocation.map((loc) => (
                          <TableRow key={loc.location_id} sx={{ borderBottom: '1px solid #333' }}>
                            <TableCell sx={{ color: '#fff' }}>{loc.location_name}</TableCell>
                            <TableCell sx={{ color: '#999' }}>{loc.client_name}</TableCell>
                            <TableCell sx={{ color: '#F4D03F' }} align="right">{loc.reproducciones}</TableCell>
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

        {/* Tab 4: Heatmap */}
        {tabValue === 4 && (
          <Card sx={{ backgroundColor: '#222' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#F4D03F' }}>
                  Actividad por Hora y Dia
                </Typography>
                <Tooltip title="Muestra la distribucion de reproducciones por hora del dia y dia de la semana">
                  <HelpOutlineIcon sx={{ fontSize: 18, color: '#666' }} />
                </Tooltip>
              </Box>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis
                    type="number"
                    dataKey="hora"
                    domain={[0, 23]}
                    tick={{ fill: '#999' }}
                    tickFormatter={(v) => `${v}:00`}
                    name="Hora"
                  />
                  <YAxis
                    type="number"
                    dataKey="dia_semana"
                    domain={[0, 6]}
                    tick={{ fill: '#999' }}
                    tickFormatter={(v) => ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][v]}
                    name="Dia"
                  />
                  <ZAxis type="number" dataKey="reproducciones" range={[50, 500]} name="Reproducciones" />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#333', border: '1px solid #F4D03F' }}
                    formatter={(value, name) => [value, name]}
                  />
                  <Scatter data={processHeatmapData()} fill="#F4D03F" />
                </ScatterChart>
              </ResponsiveContainer>
              <Typography variant="caption" sx={{ color: '#666', display: 'block', mt: 1, textAlign: 'center' }}>
                El tamano del punto representa la cantidad de reproducciones
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Tab 5: Data Quality */}
        {tabValue === 5 && (
          <Grid container spacing={2}>
            {/* Data Quality Metrics */}
            <Grid item xs={12}>
              <Card sx={{ backgroundColor: '#222' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <WarningIcon sx={{ color: '#FF9800' }} />
                    <Typography variant="h6" sx={{ color: '#FF9800' }}>
                      Metricas de Calidad de Datos
                    </Typography>
                    <Tooltip title={METRIC_TOOLTIPS.data_quality}>
                      <HelpOutlineIcon sx={{ fontSize: 18, color: '#666' }} />
                    </Tooltip>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#333' }}>
                          <TableCell sx={{ color: '#FF9800' }}>Fecha</TableCell>
                          <TableCell sx={{ color: '#FF9800' }} align="right">Total</TableCell>
                          <TableCell sx={{ color: '#FF9800' }} align="right">Completados</TableCell>
                          <TableCell sx={{ color: '#FF9800' }} align="right">Tasa %</TableCell>
                          <TableCell sx={{ color: '#FF9800' }} align="right">Muy Cortos (&lt;5s)</TableCell>
                          <TableCell sx={{ color: '#FF9800' }} align="right">Muy Largos (&gt;10m)</TableCell>
                          <TableCell sx={{ color: '#FF9800' }} align="right">Sin Song ID</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.dataQuality.slice(0, 10).map((row) => (
                          <TableRow key={row.fecha} sx={{ borderBottom: '1px solid #333' }}>
                            <TableCell sx={{ color: '#fff' }}>{row.fecha}</TableCell>
                            <TableCell sx={{ color: '#999' }} align="right">{row.total_plays}</TableCell>
                            <TableCell sx={{ color: '#4CAF50' }} align="right">{row.completed_plays}</TableCell>
                            <TableCell sx={{ color: row.completion_rate > 80 ? '#4CAF50' : '#FF9800' }} align="right">
                              {row.completion_rate}%
                            </TableCell>
                            <TableCell sx={{ color: row.very_short_plays > 10 ? '#f44336' : '#999' }} align="right">
                              {row.very_short_plays}
                            </TableCell>
                            <TableCell sx={{ color: row.very_long_plays > 5 ? '#f44336' : '#999' }} align="right">
                              {row.very_long_plays}
                            </TableCell>
                            <TableCell sx={{ color: row.missing_song_id > 0 ? '#f44336' : '#999' }} align="right">
                              {row.missing_song_id}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Suspicious Activity */}
            <Grid item xs={12}>
              <Card sx={{ backgroundColor: '#222', borderLeft: '4px solid #f44336' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <WarningIcon sx={{ color: '#f44336' }} />
                    <Typography variant="h6" sx={{ color: '#f44336' }}>
                      Actividad Sospechosa
                    </Typography>
                    <Tooltip title={METRIC_TOOLTIPS.suspicious_activity}>
                      <HelpOutlineIcon sx={{ fontSize: 18, color: '#666' }} />
                    </Tooltip>
                  </Box>
                  {data.suspiciousActivity.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: '#333' }}>
                            <TableCell sx={{ color: '#f44336' }}>Usuario</TableCell>
                            <TableCell sx={{ color: '#f44336' }}>Email</TableCell>
                            <TableCell sx={{ color: '#f44336' }}>Fecha</TableCell>
                            <TableCell sx={{ color: '#f44336' }} align="right">Plays</TableCell>
                            <TableCell sx={{ color: '#f44336' }} align="right">Avg Duracion</TableCell>
                            <TableCell sx={{ color: '#f44336' }}>Flags</TableCell>
                            <TableCell sx={{ color: '#f44336' }}>Acciones</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {data.suspiciousActivity.map((row, idx) => (
                            <TableRow key={`${row.user_id}-${row.fecha}-${idx}`} sx={{ borderBottom: '1px solid #333', backgroundColor: '#2a0000' }}>
                              <TableCell sx={{ color: '#fff' }}>{row.full_name}</TableCell>
                              <TableCell sx={{ color: '#999' }}>{row.email}</TableCell>
                              <TableCell sx={{ color: '#999' }}>{row.fecha}</TableCell>
                              <TableCell sx={{ color: '#f44336' }} align="right">{row.plays_count}</TableCell>
                              <TableCell sx={{ color: '#999' }} align="right">{row.avg_duration}s</TableCell>
                              <TableCell>
                                {row.volume_flag !== 'NORMAL' && (
                                  <Chip label={row.volume_flag} size="small" sx={{ mr: 0.5, backgroundColor: '#f44336', color: '#fff' }} />
                                )}
                                {row.duration_flag !== 'NORMAL' && (
                                  <Chip label={row.duration_flag} size="small" sx={{ mr: 0.5, backgroundColor: '#FF9800', color: '#000' }} />
                                )}
                                {row.repetition_flag !== 'NORMAL' && (
                                  <Chip label={row.repetition_flag} size="small" sx={{ backgroundColor: '#9C27B0', color: '#fff' }} />
                                )}
                              </TableCell>
                              <TableCell>
                                <Tooltip title="Excluir de analytics">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenExclusionDialog(row, true)}
                                    sx={{ color: '#f44336' }}
                                  >
                                    <PersonOffIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="success">No se detectaron actividades sospechosas</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Tab 6: Excluded Users */}
        {tabValue === 6 && (
          <Card sx={{ backgroundColor: '#222', borderLeft: '4px solid #FF9800' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonOffIcon sx={{ color: '#FF9800' }} />
                <Typography variant="h6" sx={{ color: '#FF9800' }}>
                  Usuarios Excluidos de Analytics y Regalias
                </Typography>
              </Box>
              {data.excludedUsers && data.excludedUsers.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#333' }}>
                        <TableCell sx={{ color: '#FF9800' }}>Email</TableCell>
                        <TableCell sx={{ color: '#FF9800' }}>Nombre</TableCell>
                        <TableCell sx={{ color: '#FF9800' }}>Rol</TableCell>
                        <TableCell sx={{ color: '#FF9800' }}>Razon</TableCell>
                        <TableCell sx={{ color: '#FF9800' }} align="right">Plays (No Contados)</TableCell>
                        <TableCell sx={{ color: '#FF9800' }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.excludedUsers.map((user) => (
                        <TableRow key={user.id} sx={{ borderBottom: '1px solid #333', backgroundColor: '#2a0000' }}>
                          <TableCell sx={{ color: '#fff' }}>{user.email}</TableCell>
                          <TableCell sx={{ color: '#999' }}>{user.full_name}</TableCell>
                          <TableCell sx={{ color: '#999' }}>
                            <Chip label={user.role} size="small" />
                          </TableCell>
                          <TableCell sx={{ color: '#FF9800' }}>
                            <strong>{user.exclude_reason || 'Sin especificar'}</strong>
                          </TableCell>
                          <TableCell sx={{ color: '#FF9800' }} align="right">{user.total_plays || 0}</TableCell>
                          <TableCell>
                            <Tooltip title="Incluir en analytics">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenExclusionDialog(user, false)}
                                sx={{ color: '#4CAF50' }}
                              >
                                <GroupIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="success">No hay usuarios excluidos</Alert>
              )}
              <Typography variant="caption" sx={{ color: '#999', mt: 2, display: 'block' }}>
                <strong>Nota:</strong> Los usuarios excluidos no contaran en los calculos de regalias ni en los analytics.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Tab 7: Audit Log */}
        {tabValue === 7 && (
          <Card sx={{ backgroundColor: '#222' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HistoryIcon sx={{ color: '#2196F3' }} />
                <Typography variant="h6" sx={{ color: '#2196F3' }}>
                  Historial de Cambios (Auditoria)
                </Typography>
                <Tooltip title={METRIC_TOOLTIPS.audit_log}>
                  <HelpOutlineIcon sx={{ fontSize: 18, color: '#666' }} />
                </Tooltip>
              </Box>
              {data.auditLog && data.auditLog.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#333' }}>
                        <TableCell sx={{ color: '#2196F3' }}>Fecha</TableCell>
                        <TableCell sx={{ color: '#2196F3' }}>Usuario Afectado</TableCell>
                        <TableCell sx={{ color: '#2196F3' }}>Accion</TableCell>
                        <TableCell sx={{ color: '#2196F3' }}>Razon</TableCell>
                        <TableCell sx={{ color: '#2196F3' }}>Modificado Por</TableCell>
                        <TableCell sx={{ color: '#2196F3' }}>Notas</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.auditLog.map((log) => (
                        <TableRow key={log.id} sx={{ borderBottom: '1px solid #333' }}>
                          <TableCell sx={{ color: '#999' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell sx={{ color: '#fff' }}>
                            {log.user_name} ({log.user_email})
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={log.action}
                              size="small"
                              sx={{
                                backgroundColor: log.action === 'EXCLUDED' ? '#f44336' : '#4CAF50',
                                color: '#fff',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: '#FF9800' }}>{log.reason || '-'}</TableCell>
                          <TableCell sx={{ color: '#999' }}>{log.changed_by_name || 'Sistema'}</TableCell>
                          <TableCell sx={{ color: '#666' }}>{log.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No hay registros de auditoria</Alert>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Exclusion Dialog */}
      <Dialog
        open={exclusionDialog.open}
        onClose={() => setExclusionDialog({ ...exclusionDialog, open: false })}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { backgroundColor: '#222', color: '#fff' } }}
      >
        <DialogTitle sx={{ color: exclusionDialog.exclude ? '#FF9800' : '#4CAF50' }}>
          {exclusionDialog.exclude ? 'Excluir Usuario de Analytics' : 'Incluir Usuario en Analytics'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: '#999' }}>
            Usuario: <strong style={{ color: '#fff' }}>
              {exclusionDialog.user?.user_name || exclusionDialog.user?.full_name || exclusionDialog.user?.email}
            </strong>
          </Typography>

          {exclusionDialog.exclude && (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel sx={{ color: '#999' }}>Razon</InputLabel>
                <Select
                  value={exclusionDialog.reasonCode}
                  onChange={(e) => setExclusionDialog({ ...exclusionDialog, reasonCode: e.target.value })}
                  label="Razon"
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' } }}
                >
                  {data.exclusionReasons.map((r) => (
                    <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {exclusionDialog.reasonCode === 'OTHER' && (
                <TextField
                  fullWidth
                  label="Razon personalizada"
                  value={exclusionDialog.customReason}
                  onChange={(e) => setExclusionDialog({ ...exclusionDialog, customReason: e.target.value })}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': { color: '#fff' },
                    '& .MuiInputLabel-root': { color: '#999' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
                  }}
                />
              )}
            </>
          )}

          <TextField
            fullWidth
            label="Notas (opcional)"
            multiline
            rows={2}
            value={exclusionDialog.notes}
            onChange={(e) => setExclusionDialog({ ...exclusionDialog, notes: e.target.value })}
            sx={{
              '& .MuiOutlinedInput-root': { color: '#fff' },
              '& .MuiInputLabel-root': { color: '#999' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#444' },
            }}
          />

          <Alert severity="warning" sx={{ mt: 2 }}>
            {exclusionDialog.exclude
              ? 'Las reproducciones de este usuario NO contaran para regalias ni analytics.'
              : 'Las reproducciones de este usuario SI contaran para regalias y analytics.'}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExclusionDialog({ ...exclusionDialog, open: false })} sx={{ color: '#999' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleExcludeUser}
            variant="contained"
            sx={{
              backgroundColor: exclusionDialog.exclude ? '#FF9800' : '#4CAF50',
              '&:hover': { backgroundColor: exclusionDialog.exclude ? '#e68a00' : '#45a049' },
            }}
          >
            {exclusionDialog.exclude ? 'Excluir' : 'Incluir'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AnalyticsDashboardV2;
