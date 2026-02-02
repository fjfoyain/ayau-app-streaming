import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StoreIcon from '@mui/icons-material/Store';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonIcon from '@mui/icons-material/Person';
import {
  getAllVenuesWithManager,
  getVenuesForAccount,
  getAllAccounts,
  createVenue,
  updateVenue,
  deleteVenue,
  getActiveUsers,
} from '../../services/supabase-api';

export default function VenueManager() {
  const [venues, setVenues] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [availableManagers, setAvailableManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [venueToDelete, setVenueToDelete] = useState(null);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    client_id: '',
    manager_id: '',
    address: '',
    city: '',
    country_code: 'GT',
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [selectedAccountFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [venuesData, accountsData, managersData] = await Promise.all([
        getAllVenuesWithManager(),
        getAllAccounts(),
        getActiveUsers(),
      ]);
      setVenues(venuesData || []);
      setAccounts(accountsData || []);
      setAvailableManagers(managersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      let venuesData;
      if (selectedAccountFilter) {
        venuesData = await getVenuesForAccount(selectedAccountFilter);
      } else {
        venuesData = await getAllVenuesWithManager();
      }
      setVenues(venuesData || []);
    } catch (error) {
      console.error('Error fetching venues:', error);
    }
  };

  const handleOpenCreateDialog = () => {
    setEditingVenue(null);
    setFormData({
      name: '',
      client_id: selectedAccountFilter || '',
      manager_id: '',
      address: '',
      city: '',
      country_code: 'GT',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (venue) => {
    setEditingVenue(venue);
    setFormData({
      name: venue.name || '',
      client_id: venue.client_id || '',
      manager_id: venue.manager_id || '',
      address: venue.address || '',
      city: venue.city || '',
      country_code: venue.country_code || 'GT',
      is_active: venue.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVenue(null);
    setFormData({
      name: '',
      client_id: '',
      manager_id: '',
      address: '',
      city: '',
      country_code: 'GT',
      is_active: true,
    });
  };

  const handleSaveVenue = async () => {
    if (!formData.name.trim()) {
      alert('El nombre del local es requerido');
      return;
    }
    if (!formData.client_id) {
      alert('Debes seleccionar una cuenta');
      return;
    }

    setSaving(true);
    try {
      // Prepare data - convert empty manager_id to null
      const dataToSave = {
        ...formData,
        manager_id: formData.manager_id || null,
      };

      if (editingVenue) {
        // Update existing venue
        await updateVenue(editingVenue.id, dataToSave);
        alert('Local actualizado exitosamente');
      } else {
        // Create new venue
        await createVenue(dataToSave);
        alert('Local creado exitosamente');
      }
      handleCloseDialog();
      fetchVenues();
    } catch (error) {
      console.error('Error saving venue:', error);
      alert('Error al guardar el local: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDeleteDialog = (venue) => {
    setVenueToDelete(venue);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setVenueToDelete(null);
  };

  const handleDeleteVenue = async () => {
    if (!venueToDelete) return;

    setSaving(true);
    try {
      await deleteVenue(venueToDelete.id);
      alert('Local eliminado exitosamente');
      handleCloseDeleteDialog();
      fetchVenues();
    } catch (error) {
      console.error('Error deleting venue:', error);
      alert('Error al eliminar el local: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getAccountName = (clientId) => {
    const account = accounts.find((a) => a.id === clientId);
    return account ? account.name : 'Cuenta desconocida';
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h3" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
          Gestión de Locales
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
          sx={{
            backgroundColor: '#F4D03F',
            color: '#000',
            fontWeight: 'bold',
            '&:hover': {
              backgroundColor: '#F4D03Fdd',
            },
          }}
        >
          Nuevo Local
        </Button>
      </Box>

      {/* Account Filter */}
      <Box sx={{ mb: 3 }}>
        <FormControl
          sx={{
            minWidth: 300,
            '& .MuiOutlinedInput-root': {
              color: '#F4D03F',
              '& fieldset': { borderColor: '#F4D03F44' },
              '&:hover fieldset': { borderColor: '#F4D03F' },
              '&.Mui-focused fieldset': { borderColor: '#F4D03F' },
            },
            '& .MuiInputLabel-root': { color: '#F4D03F99' },
            '& .MuiInputLabel-root.Mui-focused': { color: '#F4D03F' },
            '& .MuiSvgIcon-root': { color: '#F4D03F' },
          }}
        >
          <InputLabel>Filtrar por Cuenta</InputLabel>
          <Select
            value={selectedAccountFilter}
            onChange={(e) => setSelectedAccountFilter(e.target.value)}
            label="Filtrar por Cuenta"
            startAdornment={<FilterListIcon sx={{ mr: 1, color: '#F4D03F99' }} />}
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
      </Box>

      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: '#000',
          border: '2px solid #F4D03F',
          borderRadius: '16px',
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ borderBottom: '2px solid #F4D03F44' }}>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Nombre del Local</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Cuenta</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Gerente</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Ciudad</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Activo</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {venues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ color: '#F4D03F66', py: 6 }}>
                  <StoreIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                  <Typography variant="h6" sx={{ color: '#F4D03F66' }}>
                    {selectedAccountFilter
                      ? 'Esta cuenta no tiene locales registrados'
                      : 'No hay locales registrados'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#F4D03F44', mt: 1 }}>
                    Crea el primer local para comenzar
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              venues.map((venue) => (
                <TableRow
                  key={venue.id}
                  sx={{
                    '&:hover': { backgroundColor: '#F4D03F11' },
                    borderBottom: '1px solid #F4D03F22',
                  }}
                >
                  <TableCell sx={{ color: '#F4D03F' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StoreIcon sx={{ color: '#F4D03F99' }} />
                      {venue.name}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>
                    <Chip
                      label={getAccountName(venue.client_id)}
                      size="small"
                      sx={{
                        backgroundColor: '#F4D03F22',
                        color: '#F4D03F',
                        border: '1px solid #F4D03F44',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>
                    {venue.manager ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon sx={{ fontSize: 16, color: '#F4D03F66' }} />
                        <Typography variant="body2" sx={{ color: '#F4D03F' }}>
                          {venue.manager.full_name}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#F4D03F44' }}>
                        Sin asignar
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>{venue.city || '-'}</TableCell>
                  <TableCell align="center">
                    {venue.is_active !== false ? (
                      <CheckCircleIcon sx={{ color: '#4CAF50' }} />
                    ) : (
                      <CancelIcon sx={{ color: '#F4D03F44' }} />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={() => handleOpenEditDialog(venue)}
                      sx={{ color: '#F4D03F' }}
                      title="Editar local"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleOpenDeleteDialog(venue)}
                      sx={{ color: '#ff5252' }}
                      title="Eliminar local"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog for Create/Edit Venue */}
      <Dialog
        open={dialogOpen}
        onClose={saving ? undefined : handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#000',
            border: '2px solid #F4D03F',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
          {editingVenue ? 'Editar Local' : 'Crear Nuevo Local'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <FormControl fullWidth required>
              <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                Cuenta
              </InputLabel>
              <Select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
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
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Manager Selector */}
            <FormControl
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#F4D03F',
                  '& fieldset': { borderColor: '#F4D03F44' },
                  '&:hover fieldset': { borderColor: '#F4D03F' },
                  '&.Mui-focused fieldset': { borderColor: '#F4D03F' },
                },
                '& .MuiInputLabel-root': { color: '#F4D03F99' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#F4D03F' },
                '& .MuiSvgIcon-root': { color: '#F4D03F' },
              }}
            >
              <InputLabel>Gerente del Local</InputLabel>
              <Select
                value={formData.manager_id}
                onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                label="Gerente del Local"
                startAdornment={<PersonIcon sx={{ mr: 1, color: '#F4D03F99' }} />}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#000',
                      border: '2px solid #F4D03F',
                      maxHeight: 300,
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
                  <Typography sx={{ color: '#F4D03F66', fontStyle: 'italic' }}>
                    Sin asignar
                  </Typography>
                </MenuItem>
                {availableManagers.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    <Box>
                      <Typography variant="body1">{user.full_name}</Typography>
                      <Typography variant="caption" sx={{ color: '#F4D03F66' }}>
                        {user.email}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Nombre del Local"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              label="Ciudad"
              fullWidth
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
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
              label="Dirección"
              fullWidth
              multiline
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
              label="Código de País"
              fullWidth
              value={formData.country_code}
              onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
              placeholder="GT"
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
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#F4D03F',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#F4D03F',
                    },
                  }}
                />
              }
              label="Local Activo"
              sx={{ color: '#F4D03F' }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleCloseDialog}
            disabled={saving}
            sx={{ color: '#F4D03F' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSaveVenue}
            variant="contained"
            disabled={saving}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#F4D03Fdd' },
              '&:disabled': { backgroundColor: '#F4D03F33', color: '#00000099' },
            }}
          >
            {saving ? 'Guardando...' : editingVenue ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={saving ? undefined : handleCloseDeleteDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#000',
            border: '2px solid #ff5252',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ color: '#ff5252', fontWeight: 'bold' }}>
          Confirmar Eliminación
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#F4D03F', mb: 2 }}>
            ¿Estás seguro de que deseas eliminar el local{' '}
            <strong>{venueToDelete?.name}</strong>?
          </Typography>
          <Typography sx={{ color: '#F4D03F99', fontSize: '0.9rem' }}>
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleCloseDeleteDialog}
            disabled={saving}
            sx={{
              color: '#F4D03F',
              borderColor: '#F4D03F',
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDeleteVenue}
            variant="contained"
            disabled={saving}
            sx={{
              backgroundColor: '#ff5252',
              color: '#fff',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#ff5252dd' },
              '&:disabled': { backgroundColor: '#ff525233', color: '#ffffff99' },
            }}
          >
            {saving ? 'Eliminando...' : 'Eliminar Local'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
