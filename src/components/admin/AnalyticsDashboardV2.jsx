import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
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
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupIcon from '@mui/icons-material/Group';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import StorageIcon from '@mui/icons-material/Storage';

/**
 * Component: Analytics Dashboard Mejorado v2
 * Muestra:
 * - Overview general
 * - Top canciones
 * - Top usuarios
 * - Reproducciones por día/hora
 * - Tendencias semanales/mensuales
 * - Exportar a CSV/JSON
 * - Usuarios excluidos de analytics (importante para regalías)
 */
const AnalyticsDashboardV2 = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
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
  });

  // Cargar analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
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

        // Por Hora
        const { data: byHour } = await supabase
          .from('analytics_by_hour')
          .select('*')
          .order('hora', { ascending: false })
          .limit(24);

        // Tendencias Semanales
        const { data: weeklyTrends } = await supabase
          .from('analytics_weekly_trends')
          .select('*')
          .order('semana', { ascending: false });

        // Tendencias Mensuales
        const { data: monthlyTrends } = await supabase
          .from('analytics_monthly_trends')
          .select('*')
          .order('mes', { ascending: false });

        // Por Cliente
        const { data: byClient } = await supabase
          .from('analytics_by_client')
          .select('*')
          .order('reproducciones', { ascending: false });

        // Por Ubicación
        const { data: byLocation } = await supabase
          .from('analytics_by_location')
          .select('*')
          .order('reproducciones', { ascending: false });

        // Usuarios Excluidos (IMPORTANTE PARA REGALÍAS)
        const { data: excludedUsers } = await supabase
          .from('excluded_analytics_users')
          .select('*');

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
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  // Exportar a CSV
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

  // Exportar a JSON
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress sx={{ color: '#F4D03F' }} />
      </Box>
    );
  }

  const COLORS = ['#F4D03F', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0'];

  return (
    <Box sx={{ p: 3, backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
          📊 Analytics Dashboard Mejorado
        </Typography>

        {/* Exportar Buttons */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
      </Box>

      {/* Alerta Usuarios Excluidos */}
      {data.excludedUsers && data.excludedUsers.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3, backgroundColor: '#FF980020' }}>
          <strong>⚠️ {data.excludedUsers.length} usuario(s) excluido(s) de analytics:</strong>{' '}
          {data.excludedUsers.map((u) => u.email).join(', ')}
        </Alert>
      )}

      {/* Overview Cards */}
      {data.overview && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#222', borderLeft: '4px solid #F4D03F' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StorageIcon sx={{ color: '#F4D03F', fontSize: 32 }} />
                  <Box>
                    <Typography color="textSecondary" variant="caption">
                      Reproducciones
                    </Typography>
                    <Typography variant="h5" sx={{ color: '#F4D03F' }}>
                      {data.overview.total_reproducciones?.toLocaleString() || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#222', borderLeft: '4px solid #FF9800' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GroupIcon sx={{ color: '#FF9800', fontSize: 32 }} />
                  <Box>
                    <Typography color="textSecondary" variant="caption">
                      Usuarios Únicos
                    </Typography>
                    <Typography variant="h5" sx={{ color: '#FF9800' }}>
                      {data.overview.usuarios_unicos || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#222', borderLeft: '4px solid #4CAF50' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon sx={{ color: '#4CAF50', fontSize: 32 }} />
                  <Box>
                    <Typography color="textSecondary" variant="caption">
                      Horas Reproducidas
                    </Typography>
                    <Typography variant="h5" sx={{ color: '#4CAF50' }}>
                      {data.overview.horas_reproducidas || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#222', borderLeft: '4px solid #2196F3' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MusicNoteIcon sx={{ color: '#2196F3', fontSize: 32 }} />
                  <Box>
                    <Typography color="textSecondary" variant="caption">
                      Canciones
                    </Typography>
                    <Typography variant="h5" sx={{ color: '#2196F3' }}>
                      {data.overview.canciones_reproducidas || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        sx={{
          borderBottom: '2px solid #F4D03F',
          '& .MuiTab-root': {
            color: '#999',
            '&.Mui-selected': {
              color: '#F4D03F',
            },
          },
        }}
      >
        <Tab label="🎵 Top Canciones" />
        <Tab label="👥 Top Usuarios" />
        <Tab label="📈 Tendencias Diarias" />
        <Tab label="📊 Tendencias Mensuales" />
        <Tab label="🏢 Por Ubicación" />
        <Tab label="🏭 Por Cuenta" />
        <Tab label="⚠️ Excluidos (Regalías)" />
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
                    Gráfico: Top 10 Canciones Reproducidas
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
                          <TableCell sx={{ color: '#F4D03F' }} align="right">
                            Completitud %
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.topSongs.map((song, idx) => (
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
                            <TableCell
                              sx={{
                                color:
                                  song.completitud_promedio_pct > 80
                                    ? '#4CAF50'
                                    : '#FF9800',
                              }}
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
                      <TableCell sx={{ color: '#F4D03F' }} align="right">
                        Rango Actividad
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.topUsers.map((user, idx) => (
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
                        <TableCell sx={{ color: '#999' }} align="right">
                          {user.rango_actividad}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Daily Trends */}
        {tabValue === 2 && (
          <Card sx={{ backgroundColor: '#222' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                Tendencias Diarias (Últimos 30 Días)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data.byDay}>
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
                  <Line
                    type="monotone"
                    dataKey="usuarios_unicos"
                    stroke="#FF9800"
                    dot={false}
                    name="Usuarios Únicos"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Monthly Trends */}
        {tabValue === 3 && (
          <Card sx={{ backgroundColor: '#222' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                Tendencias Mensuales (Últimos 12 Meses)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.monthlyTrends}>
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
                  <Bar dataKey="usuarios_unicos" fill="#FF9800" name="Usuarios" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tab 4: By Location */}
        {tabValue === 4 && (
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
                    {data.byLocation.map((loc) => (
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

        {/* Tab 5: By Client */}
        {tabValue === 5 && (
          <Card sx={{ backgroundColor: '#222' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                Reproducciones por Cuenta/Cliente
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

        {/* Tab 6: Excluded Users (CRITICAL) */}
        {tabValue === 6 && (
          <Card sx={{ backgroundColor: '#222', borderLeft: '4px solid #FF9800' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: '#FF9800', mb: 2 }}>
                ⚠️ Usuarios Excluidos de Analytics y Regalías
              </Typography>
              {data.excludedUsers && data.excludedUsers.length > 0 ? (
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
                        <TableCell sx={{ color: '#FF9800' }}>Fecha Exclusión</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.excludedUsers.map((user) => (
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
                          <TableCell sx={{ color: '#999' }}>
                            {new Date(user.created_at).toLocaleDateString()}
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
      </Box>
    </Box>
  );
};

export default AnalyticsDashboardV2;
