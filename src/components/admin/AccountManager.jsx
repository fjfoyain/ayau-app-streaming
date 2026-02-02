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
import BusinessIcon from '@mui/icons-material/Business';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SyncIcon from '@mui/icons-material/Sync';
import {
  getAllAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../../services/supabase-api';

export default function AccountManager() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    contact_phone: '',
    tax_id: '',
    playback_mode: 'independent',
    is_active: true,
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await getAllAccounts();
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      alert('Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      contact_email: '',
      contact_phone: '',
      tax_id: '',
      playback_mode: 'independent',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name || '',
      contact_email: account.contact_email || '',
      contact_phone: account.contact_phone || '',
      tax_id: account.tax_id || '',
      playback_mode: account.playback_mode || 'independent',
      is_active: account.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    setFormData({
      name: '',
      contact_email: '',
      contact_phone: '',
      tax_id: '',
      playback_mode: 'independent',
      is_active: true,
    });
  };

  const handleSaveAccount = async () => {
    if (!formData.name.trim()) {
      alert('El nombre de la cuenta es requerido');
      return;
    }

    setSaving(true);
    try {
      if (editingAccount) {
        // Update existing account
        await updateAccount(editingAccount.id, formData);
        alert('Cuenta actualizada exitosamente');
      } else {
        // Create new account
        await createAccount(formData);
        alert('Cuenta creada exitosamente');
      }
      handleCloseDialog();
      fetchAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      alert('Error al guardar la cuenta: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDeleteDialog = (account) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setAccountToDelete(null);
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;

    setSaving(true);
    try {
      await deleteAccount(accountToDelete.id);
      alert('Cuenta eliminada exitosamente');
      handleCloseDeleteDialog();
      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Error al eliminar la cuenta: ' + error.message);
    } finally {
      setSaving(false);
    }
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
          Gestión de Cuentas
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
          Nueva Cuenta
        </Button>
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
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Nombre</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Email de Contacto</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Teléfono</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Tax ID</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center"># Locales</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Activo</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: '#F4D03F66', py: 6 }}>
                  <BusinessIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
                  <Typography variant="h6" sx={{ color: '#F4D03F66' }}>
                    No hay cuentas registradas
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#F4D03F44', mt: 1 }}>
                    Crea la primera cuenta para comenzar
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow
                  key={account.id}
                  sx={{
                    '&:hover': { backgroundColor: '#F4D03F11' },
                    borderBottom: '1px solid #F4D03F22',
                  }}
                >
                  <TableCell sx={{ color: '#F4D03F' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessIcon sx={{ color: '#F4D03F99' }} />
                      {account.name}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>{account.contact_email || '-'}</TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>{account.contact_phone || '-'}</TableCell>
                  <TableCell sx={{ color: '#F4D03F99' }}>{account.tax_id || '-'}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={account.venue_count || 0}
                      size="small"
                      sx={{
                        backgroundColor: account.venue_count > 0 ? '#F4D03F22' : '#F4D03F11',
                        color: '#F4D03F',
                        fontWeight: 'bold',
                        border: '1px solid #F4D03F44',
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    {account.is_active !== false ? (
                      <CheckCircleIcon sx={{ color: '#4CAF50' }} />
                    ) : (
                      <CancelIcon sx={{ color: '#F4D03F44' }} />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={() => handleOpenEditDialog(account)}
                      sx={{ color: '#F4D03F' }}
                      title="Editar cuenta"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleOpenDeleteDialog(account)}
                      sx={{ color: '#ff5252' }}
                      title="Eliminar cuenta"
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

      {/* Dialog for Create/Edit Account */}
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
          {editingAccount ? 'Editar Cuenta' : 'Crear Nueva Cuenta'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="Nombre de la Cuenta"
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
              label="Email de Contacto"
              type="email"
              fullWidth
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
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
              label="Teléfono de Contacto"
              fullWidth
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
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
              label="Tax ID / RFC"
              fullWidth
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
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

            {/* Playback Mode Selector */}
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
              <InputLabel>Modo de Reproducción</InputLabel>
              <Select
                value={formData.playback_mode}
                onChange={(e) => setFormData({ ...formData, playback_mode: e.target.value })}
                label="Modo de Reproducción"
                startAdornment={<SyncIcon sx={{ mr: 1, color: '#F4D03F99' }} />}
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
                <MenuItem value="independent">
                  <Box>
                    <Typography variant="body1">Independiente</Typography>
                    <Typography variant="caption" sx={{ color: '#F4D03F66' }}>
                      Cada local controla su propia música
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="shared_playlist">
                  <Box>
                    <Typography variant="body1">Playlist Compartida</Typography>
                    <Typography variant="caption" sx={{ color: '#F4D03F66' }}>
                      Mismas playlists, reproducción libre
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="synchronized">
                  <Box>
                    <Typography variant="body1">Sincronizado</Typography>
                    <Typography variant="caption" sx={{ color: '#F4D03F66' }}>
                      Un admin controla toda la reproducción
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

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
              label="Cuenta Activa"
              sx={{ color: '#F4D03F' }}
            />
            {editingAccount && (
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: '#F4D03F11',
                  border: '1px solid #F4D03F44',
                  borderRadius: '8px',
                }}
              >
                <Typography variant="body2" sx={{ color: '#F4D03F99', fontSize: '0.85rem' }}>
                  <strong style={{ color: '#F4D03F' }}>Nota:</strong> Esta cuenta tiene{' '}
                  {editingAccount.venue_count || 0} local(es) asociado(s).
                </Typography>
              </Paper>
            )}
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
            onClick={handleSaveAccount}
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
            {saving ? 'Guardando...' : editingAccount ? 'Actualizar' : 'Crear'}
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
            ¿Estás seguro de que deseas eliminar la cuenta{' '}
            <strong>{accountToDelete?.name}</strong>?
          </Typography>
          {accountToDelete?.venue_count > 0 && (
            <Paper
              sx={{
                p: 2,
                backgroundColor: '#ff525222',
                border: '1px solid #ff525244',
                borderRadius: '8px',
              }}
            >
              <Typography variant="body2" sx={{ color: '#ff5252', fontSize: '0.85rem' }}>
                <strong>⚠️ ADVERTENCIA:</strong> Esta cuenta tiene {accountToDelete.venue_count} local(es)
                asociado(s). Al eliminar esta cuenta, todos los locales relacionados también serán afectados.
              </Typography>
            </Paper>
          )}
          <Typography sx={{ color: '#F4D03F99', mt: 2, fontSize: '0.9rem' }}>
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
            onClick={handleDeleteAccount}
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
            {saving ? 'Eliminando...' : 'Eliminar Cuenta'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
