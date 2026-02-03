import { useState, useEffect } from 'react';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
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
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  getAllUsers,
  createUser,
  updateUserProfile,
  getUserPermissions,
  assignPlaylistToUser,
  removePlaylistFromUser,
  getUserPlaylists,
  createUserWithAccess,
  getAllAccounts,
  getAllVenues,
  getVenuesForAccount,
  deleteUser,
} from '../../services/supabase-api';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [venues, setVenues] = useState([]);
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [userPermissions, setUserPermissions] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [selectedPermissionLevel, setSelectedPermissionLevel] = useState('view');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    access_level: 'location',
    client_id: '',
    location_id: '',
    exclude_from_analytics: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Filter venues when client_id changes
  useEffect(() => {
    if (newUserData.client_id) {
      const filtered = venues.filter((v) => v.client_id === newUserData.client_id);
      setFilteredVenues(filtered);
    } else {
      setFilteredVenues([]);
    }
  }, [newUserData.client_id, venues]);

  const fetchData = async () => {
    try {
      const [usersData, playlistsData, accountsData, venuesData] = await Promise.all([
        getAllUsers(),
        getUserPlaylists(),
        getAllAccounts(),
        getAllVenues(),
      ]);
      setUsers(usersData);
      setPlaylists(playlistsData);
      setAccounts(accountsData);
      setVenues(venuesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRoleDialog = (user) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setRoleDialogOpen(true);
  };

  const handleCloseRoleDialog = () => {
    setRoleDialogOpen(false);
    setSelectedUser(null);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    try {
      await updateUserProfile(selectedUser.id, { role: selectedRole });
      alert('Rol actualizado exitosamente');
      handleCloseRoleDialog();
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Error al actualizar el rol');
    }
  };

  const handleOpenCreateUserDialog = () => {
    setNewUserData({
      email: '',
      password: '',
      full_name: '',
      role: 'user',
      access_level: 'location',
      client_id: '',
      location_id: '',
      exclude_from_analytics: false,
    });
    setCreateUserDialogOpen(true);
  };

  const handleCloseCreateUserDialog = () => {
    setCreateUserDialogOpen(false);
    setNewUserData({
      email: '',
      password: '',
      full_name: '',
      role: 'user',
      access_level: 'location',
      client_id: '',
      location_id: '',
    });
  };

  // Generar contraseña temporal segura
  const generateTemporaryPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  // Handlers para modal de contraseña
  const handleOpenPasswordDialog = (password) => {
    setGeneratedPassword(password);
    setPasswordDialogOpen(true);
  };

  const handleClosePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setGeneratedPassword('');
    handleCloseCreateUserDialog();
    fetchData();
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    alert('Contraseña copiada al portapapeles');
  };

  const handleCreateUser = async () => {
    if (!newUserData.email || !newUserData.full_name) {
      alert('Email y nombre completo son requeridos');
      return;
    }

    // Validate access level requirements
    if (newUserData.access_level === 'account' && !newUserData.client_id) {
      alert('Debes seleccionar una cuenta para usuarios con nivel de cuenta');
      return;
    }
    if (newUserData.access_level === 'location' && !newUserData.location_id) {
      alert('Debes seleccionar un local para usuarios con nivel de local');
      return;
    }

    setSaving(true);
    try {
      // Generar contraseña temporal si no se proporciona
      const finalPassword = newUserData.password || generateTemporaryPassword();
      const dataToSend = { ...newUserData, password: finalPassword };

      // Use createUserWithAccess if access_level fields are set
      if (newUserData.access_level && (newUserData.client_id || newUserData.location_id)) {
        await createUserWithAccess(dataToSend);
      } else {
        await createUser(dataToSend);
      }

      // Mostrar modal con contraseña temporal
      handleOpenPasswordDialog(finalPassword);
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error al crear usuario: ' + error.message);
      setSaving(false);
    }
  };

  const handleOpenPermissionsDialog = async (user) => {
    setSelectedUser(user);
    setSelectedPlaylist('');
    setPermissionsDialogOpen(true);

    try {
      const permissions = await getUserPermissions(user.id);
      setUserPermissions(permissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setUserPermissions([]);
    }
  };

  const handleClosePermissionsDialog = () => {
    setPermissionsDialogOpen(false);
    setSelectedUser(null);
    setUserPermissions([]);
  };

  const handleAssignPlaylist = async () => {
    if (!selectedUser || !selectedPlaylist) return;

    try {
      await assignPlaylistToUser(selectedUser.id, selectedPlaylist, selectedPermissionLevel);
      alert('Playlist asignada exitosamente');
      // Refresh permissions
      const permissions = await getUserPermissions(selectedUser.id);
      setUserPermissions(permissions);
      setSelectedPlaylist('');
    } catch (error) {
      console.error('Error assigning playlist:', error);
      alert('Error al asignar la playlist');
    }
  };

  const handleRemovePermission = async (userId, playlistId) => {
    if (!confirm('¿Eliminar este permiso?')) return;

    try {
      await removePlaylistFromUser(userId, playlistId);
      // Refresh permissions
      const permissions = await getUserPermissions(userId);
      setUserPermissions(permissions);
    } catch (error) {
      console.error('Error removing permission:', error);
      alert('Error al eliminar el permiso');
    }
  };

  const handleOpenDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setSaving(true);
    try {
      await deleteUser(userToDelete.id);
      alert('Usuario eliminado exitosamente');
      handleCloseDeleteDialog();
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar usuario: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return <AdminPanelSettingsIcon sx={{ color: '#F4D03F' }} />;
      default:
        return <PersonIcon sx={{ color: '#F4D03F99' }} />;
    }
  };

  const getRoleChip = (role) => {
    const colors = {
      admin: '#F4D03F',
      manager: '#2196F3',
      user: '#4CAF50',
      client_user: '#9C27B0',
    };

    return (
      <Chip
        label={role.toUpperCase()}
        size="small"
        sx={{
          backgroundColor: colors[role] || '#666',
          color: role === 'admin' ? '#000' : '#fff',
          fontWeight: 'bold',
        }}
      />
    );
  };

  const getAccessScope = (user) => {
    if (user.role === 'admin') {
      return 'Acceso Total';
    }
    if (user.access_level === 'account' && user.client_id) {
      const account = accounts.find((a) => a.id === user.client_id);
      return account ? `Cuenta: ${account.name}` : 'Cuenta no encontrada';
    }
    if (user.access_level === 'location' && user.location_id) {
      const venue = venues.find((v) => v.id === user.location_id);
      return venue ? `Local: ${venue.name}` : 'Local no encontrado';
    }
    return '-';
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
          Gestión de Usuarios
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateUserDialog}
          sx={{
            backgroundColor: '#F4D03F',
            color: '#000',
            fontWeight: 'bold',
            '&:hover': {
              backgroundColor: '#F4D03Fdd',
            },
          }}
        >
          Nuevo Usuario
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
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Email</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Nombre</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Rol</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Alcance de Acceso</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Excluido Analytics</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Verificado</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Activo</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                sx={{
                  '&:hover': { backgroundColor: '#F4D03F11' },
                  borderBottom: '1px solid #F4D03F22',
                }}
              >
                <TableCell sx={{ color: '#F4D03F' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getRoleIcon(user.role)}
                    {user.email || 'Sin email'}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: '#F4D03F99' }}>{user.full_name || '-'}</TableCell>
                <TableCell align="center">{getRoleChip(user.role)}</TableCell>
                <TableCell sx={{ color: '#F4D03F99' }}>{getAccessScope(user)}</TableCell>
                <TableCell align="center">
                  <Checkbox
                    checked={!!user.exclude_from_analytics}
                    onChange={async (e) => {
                      setSaving(true);
                      try {
                        await updateUserProfile(user.id, { exclude_from_analytics: e.target.checked });
                        fetchData();
                      } catch (err) {
                        alert('Error al actualizar exclusión de analytics');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    color="warning"
                    inputProps={{ 'aria-label': 'Excluir de analytics' }}
                    disabled={saving}
                  />
                </TableCell>
                <TableCell align="center">
                  {user.email_confirmed_at ? (
                    <CheckCircleIcon sx={{ color: '#2196F3' }} titleAccess="Email verificado" />
                  ) : (
                    <CancelIcon sx={{ color: '#FF9800' }} titleAccess="Email no verificado" />
                  )}
                </TableCell>
                <TableCell align="center">
                  {user.is_active !== false ? (
                    <CheckCircleIcon sx={{ color: '#4CAF50' }} titleAccess="Usuario activo" />
                  ) : (
                    <CancelIcon sx={{ color: '#f44336' }} titleAccess="Usuario inactivo" />
                  )}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={() => handleOpenRoleDialog(user)}
                    sx={{ color: '#F4D03F' }}
                    title="Editar rol"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleOpenPermissionsDialog(user)}
                    sx={{ color: '#4CAF50' }}
                    title="Gestionar permisos"
                  >
                    <PlaylistAddIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleOpenDeleteDialog(user)}
                    sx={{ color: '#ff5252' }}
                    title="Eliminar usuario"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog for Editing User */}
      <Dialog
        open={roleDialogOpen}
        onClose={handleCloseRoleDialog}
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
          Editar Usuario
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#F4D03F99', mb: 1 }}>
            Usuario: <strong style={{ color: '#F4D03F' }}>{selectedUser?.full_name}</strong>
          </Typography>
          <Typography sx={{ color: '#F4D03F66', mb: 3, fontSize: '0.85rem' }}>
            {selectedUser?.email}
          </Typography>

          {/* Status Indicators */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Chip
              icon={selectedUser?.is_active ? <CheckCircleIcon /> : <CancelIcon />}
              label={selectedUser?.is_active ? 'Activo' : 'Inactivo'}
              sx={{
                backgroundColor: selectedUser?.is_active ? '#4CAF5033' : '#f4433633',
                color: selectedUser?.is_active ? '#4CAF50' : '#f44336',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
            <Chip
              label={selectedUser?.email_confirmed_at ? 'Email Verificado' : 'Email No Verificado'}
              sx={{
                backgroundColor: selectedUser?.email_confirmed_at ? '#2196F333' : '#FF980033',
                color: selectedUser?.email_confirmed_at ? '#2196F3' : '#FF9800',
              }}
            />
            {selectedUser?.exclude_from_analytics && (
              <Chip
                label="Excluido de Analytics"
                sx={{ backgroundColor: '#FF980033', color: '#FF9800' }}
              />
            )}
          </Box>

          {/* Role Selection */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
              Rol
            </InputLabel>
            <Select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
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
              <MenuItem value="admin">Admin - Acceso total al sistema</MenuItem>
              <MenuItem value="manager">Manager - Gestion de clientes y locaciones</MenuItem>
              <MenuItem value="user">User - Usuario regular</MenuItem>
              <MenuItem value="client_user">Client User - Usuario de cliente</MenuItem>
            </Select>
          </FormControl>

          {/* Exclude from Analytics */}
          <FormControlLabel
            control={
              <Checkbox
                checked={!!selectedUser?.exclude_from_analytics}
                onChange={async (e) => {
                  setSaving(true);
                  try {
                    await updateUserProfile(selectedUser.id, { exclude_from_analytics: e.target.checked });
                    setSelectedUser({ ...selectedUser, exclude_from_analytics: e.target.checked });
                    fetchData();
                  } catch (err) {
                    alert('Error al actualizar exclusion de analytics');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                sx={{
                  color: '#FF9800',
                  '&.Mui-checked': { color: '#FF9800' },
                }}
              />
            }
            label={
              <Box>
                <Typography sx={{ color: '#FF9800', fontWeight: 'bold' }}>
                  Excluir de Analytics y Regalias
                </Typography>
                <Typography variant="caption" sx={{ color: '#F4D03F99' }}>
                  Las reproducciones NO contaran para estadisticas ni regalias
                </Typography>
              </Box>
            }
            sx={{
              mb: 2,
              p: 2,
              width: '100%',
              backgroundColor: selectedUser?.exclude_from_analytics ? '#FF980022' : 'transparent',
              border: '1px solid #FF980044',
              borderRadius: '8px',
            }}
          />

          {/* Active/Inactive Toggle */}
          <FormControlLabel
            control={
              <Checkbox
                checked={!!selectedUser?.is_active}
                onChange={async (e) => {
                  setSaving(true);
                  try {
                    await updateUserProfile(selectedUser.id, { is_active: e.target.checked });
                    setSelectedUser({ ...selectedUser, is_active: e.target.checked });
                    fetchData();
                  } catch (err) {
                    alert('Error al actualizar estado de usuario');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                sx={{
                  color: '#4CAF50',
                  '&.Mui-checked': { color: '#4CAF50' },
                }}
              />
            }
            label={
              <Box>
                <Typography sx={{ color: selectedUser?.is_active ? '#4CAF50' : '#f44336', fontWeight: 'bold' }}>
                  Usuario Activo
                </Typography>
                <Typography variant="caption" sx={{ color: '#F4D03F99' }}>
                  {selectedUser?.is_active ? 'El usuario puede acceder al sistema' : 'El usuario NO puede acceder'}
                </Typography>
              </Box>
            }
            sx={{
              mb: 2,
              p: 2,
              width: '100%',
              backgroundColor: selectedUser?.is_active ? '#4CAF5011' : '#f4433622',
              border: `1px solid ${selectedUser?.is_active ? '#4CAF5044' : '#f4433644'}`,
              borderRadius: '8px',
            }}
          />

          {/* Manual Email Verification */}
          {!selectedUser?.email_confirmed_at && (
            <Paper
              sx={{
                p: 2,
                backgroundColor: '#FF980022',
                border: '1px solid #FF980044',
                borderRadius: '8px',
                mb: 2,
              }}
            >
              <Typography sx={{ color: '#FF9800', mb: 1, fontWeight: 'bold' }}>
                Email No Verificado
              </Typography>
              <Typography variant="caption" sx={{ color: '#F4D03F99', display: 'block', mb: 2 }}>
                El usuario no ha confirmado su email. Puedes verificarlo manualmente.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                disabled={saving}
                onClick={async () => {
                  if (!confirm('¿Verificar manualmente el email de este usuario?')) return;
                  setSaving(true);
                  try {
                    await updateUserProfile(selectedUser.id, { email_confirmed_at: new Date().toISOString() });
                    setSelectedUser({ ...selectedUser, email_confirmed_at: new Date().toISOString() });
                    fetchData();
                    alert('Email verificado manualmente');
                  } catch (err) {
                    alert('Error al verificar email: ' + err.message);
                  } finally {
                    setSaving(false);
                  }
                }}
                sx={{
                  borderColor: '#FF9800',
                  color: '#FF9800',
                  '&:hover': { backgroundColor: '#FF980022' },
                }}
              >
                Verificar Email Manualmente
              </Button>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseRoleDialog} sx={{ color: '#F4D03F' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpdateRole}
            variant="contained"
            disabled={saving}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#F4D03Fdd' },
            }}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Managing Permissions */}
      <Dialog
        open={permissionsDialogOpen}
        onClose={handleClosePermissionsDialog}
        maxWidth="md"
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
          Gestionar Permisos de Playlists
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#F4D03F99', mb: 3 }}>
            Usuario: <strong style={{ color: '#F4D03F' }}>{selectedUser?.full_name}</strong>
          </Typography>

          {/* Current Permissions */}
          <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
            Playlists Asignadas
          </Typography>
          {userPermissions.length === 0 ? (
            <Typography sx={{ color: '#F4D03F66', mb: 3, fontStyle: 'italic' }}>
              No tiene playlists asignadas
            </Typography>
          ) : (
            <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {userPermissions.map((perm) => (
                <Chip
                  key={perm.playlist_id}
                  label={`${perm.playlists.name} (${perm.permission_level})`}
                  onDelete={() => handleRemovePermission(selectedUser.id, perm.playlist_id)}
                  sx={{
                    backgroundColor: '#F4D03F22',
                    color: '#F4D03F',
                    border: '1px solid #F4D03F44',
                    '& .MuiChip-deleteIcon': {
                      color: '#F4D03F',
                      '&:hover': { color: '#F4D03Fdd' },
                    },
                  }}
                />
              ))}
            </Box>
          )}

          {/* Add New Permission */}
          <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2, mt: 4 }}>
            Asignar Nueva Playlist
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                Playlist
              </InputLabel>
              <Select
                value={selectedPlaylist}
                onChange={(e) => setSelectedPlaylist(e.target.value)}
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
                {playlists.map((playlist) => (
                  <MenuItem key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                Nivel
              </InputLabel>
              <Select
                value={selectedPermissionLevel}
                onChange={(e) => setSelectedPermissionLevel(e.target.value)}
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
                <MenuItem value="view">View</MenuItem>
                <MenuItem value="edit">Edit</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              onClick={handleAssignPlaylist}
              disabled={!selectedPlaylist}
              sx={{
                backgroundColor: '#F4D03F',
                color: '#000',
                fontWeight: 'bold',
                px: 3,
                '&:hover': { backgroundColor: '#F4D03Fdd' },
                '&:disabled': { backgroundColor: '#F4D03F33', color: '#00000099' },
              }}
            >
              Asignar
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleClosePermissionsDialog}
            variant="outlined"
            sx={{
              color: '#F4D03F',
              borderColor: '#F4D03F',
              '&:hover': {
                borderColor: '#F4D03F',
                backgroundColor: '#F4D03F22',
              },
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Creating New User */}
      <Dialog
        open={createUserDialogOpen}
        onClose={saving ? undefined : handleCloseCreateUserDialog}
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
          Crear Nuevo Usuario
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              required
              value={newUserData.email}
              onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
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
              label="Nombre Completo"
              fullWidth
              required
              value={newUserData.full_name}
              onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
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
              label="Contraseña (opcional - se generará automáticamente)"
              type="password"
              fullWidth
              value={newUserData.password}
              onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
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
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                Rol
              </InputLabel>
              <Select
                value={newUserData.role}
                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
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
                <MenuItem value="user">Usuario Regular</MenuItem>
                <MenuItem value="manager">Manager (Gestión de Contenido)</MenuItem>
                <MenuItem value="admin">Administrador</MenuItem>
                <MenuItem value="client_user">Usuario Cliente</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                Nivel de Acceso
              </InputLabel>
              <Select
                value={newUserData.access_level}
                onChange={(e) => setNewUserData({ ...newUserData, access_level: e.target.value, client_id: '', location_id: '' })}
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
                <MenuItem value="account">Nivel Cuenta (acceso a todos los locales)</MenuItem>
                <MenuItem value="location">Nivel Local (acceso a un local específico)</MenuItem>
              </Select>
            </FormControl>
            {newUserData.access_level === 'account' && (
              <FormControl fullWidth required>
                <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                  Cuenta
                </InputLabel>
                <Select
                  value={newUserData.client_id}
                  onChange={(e) => setNewUserData({ ...newUserData, client_id: e.target.value })}
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
            )}
            {newUserData.access_level === 'location' && (
              <>
                <FormControl fullWidth required>
                  <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                    Cuenta
                  </InputLabel>
                  <Select
                    value={newUserData.client_id}
                    onChange={(e) => setNewUserData({ ...newUserData, client_id: e.target.value, location_id: '' })}
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
                <FormControl fullWidth required disabled={!newUserData.client_id}>
                  <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                    Local
                  </InputLabel>
                  <Select
                    value={newUserData.location_id}
                    onChange={(e) => setNewUserData({ ...newUserData, location_id: e.target.value })}
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
                    {filteredVenues.map((venue) => (
                      <MenuItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!newUserData.exclude_from_analytics}
                  onChange={(e) => setNewUserData({ ...newUserData, exclude_from_analytics: e.target.checked })}
                  sx={{
                    color: '#FF9800',
                    '&.Mui-checked': { color: '#FF9800' },
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ color: '#FF9800', fontWeight: 'bold' }}>
                    Excluir de Analytics y Regalias
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#F4D03F99' }}>
                    Las reproducciones de este usuario NO contaran para estadisticas ni regalias
                  </Typography>
                </Box>
              }
              sx={{
                mt: 1,
                p: 2,
                backgroundColor: newUserData.exclude_from_analytics ? '#FF980022' : 'transparent',
                border: '1px solid #FF980044',
                borderRadius: '8px',
              }}
            />
            <Paper
              sx={{
                p: 2,
                backgroundColor: '#F4D03F11',
                border: '1px solid #F4D03F44',
                borderRadius: '8px',
              }}
            >
              <Typography variant="body2" sx={{ color: '#F4D03F99', fontSize: '0.85rem' }}>
                <strong style={{ color: '#F4D03F' }}>Nota:</strong> El usuario recibira un email de confirmacion
                para activar su cuenta. Si no proporcionas una contrasena, se generara una automaticamente.
              </Typography>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleCloseCreateUserDialog}
            disabled={saving}
            sx={{ color: '#F4D03F' }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreateUser}
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
            {saving ? 'Creando...' : 'Crear Usuario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
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
          Confirmar Eliminación de Usuario
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#F4D03F', mb: 2 }}>
            ¿Estás seguro de que deseas eliminar al usuario{' '}
            <strong>{userToDelete?.full_name || userToDelete?.email}</strong>?
          </Typography>
          <Paper
            sx={{
              p: 2,
              backgroundColor: '#ff525222',
              border: '1px solid #ff525244',
              borderRadius: '8px',
              mb: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: '#ff5252', fontSize: '0.85rem' }}>
              <strong>Advertencia:</strong> Esta acción desactivará al usuario y eliminará sus
              asignaciones como owner de cuenta o gerente de local.
            </Typography>
          </Paper>
          <Typography sx={{ color: '#F4D03F99', fontSize: '0.9rem' }}>
            El usuario no podrá acceder al sistema después de ser eliminado.
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
            onClick={handleDeleteUser}
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
            {saving ? 'Eliminando...' : 'Eliminar Usuario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Temporary Password Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={passwordDialogOpen ? undefined : handleClosePasswordDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#000',
            border: '2px solid #4CAF50',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ color: '#4CAF50', fontWeight: 'bold' }}>
          ✓ Usuario Creado Exitosamente
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ color: '#F4D03F', mb: 2 }}>
              El usuario <strong>{newUserData.full_name}</strong> ha sido creado exitosamente.
            </Typography>

            <Paper
              sx={{
                p: 3,
                backgroundColor: '#4CAF5022',
                border: '2px solid #4CAF50',
                borderRadius: '8px',
                mb: 3,
                textAlign: 'center',
              }}
            >
              <Typography sx={{ color: '#F4D03F99', mb: 1, fontSize: '0.85rem' }}>
                CONTRASEÑA TEMPORAL:
              </Typography>
              <Typography
                sx={{
                  color: '#4CAF50',
                  fontSize: '1.3rem',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  mb: 2,
                  wordBreak: 'break-all',
                }}
              >
                {generatedPassword}
              </Typography>
              <Button
                variant="outlined"
                onClick={handleCopyPassword}
                sx={{
                  borderColor: '#4CAF50',
                  color: '#4CAF50',
                  '&:hover': { backgroundColor: '#4CAF5022' },
                }}
              >
                Copiar Contraseña
              </Button>
            </Paper>

            <Paper
              sx={{
                p: 2,
                backgroundColor: '#FFC10722',
                border: '1px solid #FFC107',
                borderRadius: '8px',
                mb: 2,
              }}
            >
              <Typography sx={{ color: '#FFC107', fontSize: '0.85rem', fontWeight: 'bold', mb: 1 }}>
                ⚠️ IMPORTANTE:
              </Typography>
              <Typography sx={{ color: '#F4D03F99', fontSize: '0.85rem' }}>
                1. Esta contraseña será requerida en el primer login.
              </Typography>
              <Typography sx={{ color: '#F4D03F99', fontSize: '0.85rem', mt: 0.5 }}>
                2. El usuario recibirá un email de confirmación en {newUserData.email}
              </Typography>
              <Typography sx={{ color: '#F4D03F99', fontSize: '0.85rem', mt: 0.5 }}>
                3. Se recomienda compartir la contraseña de forma segura.
              </Typography>
              <Typography sx={{ color: '#F4D03F99', fontSize: '0.85rem', mt: 0.5 }}>
                4. El usuario puede cambiar su contraseña después del login.
              </Typography>
            </Paper>

            <Typography sx={{ color: '#F4D03F66', fontSize: '0.8rem', textAlign: 'center' }}>
              O el usuario puede usar el link "Olvidé mi contraseña" para establecer su propia contraseña.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleClosePasswordDialog}
            variant="contained"
            fullWidth
            sx={{
              backgroundColor: '#4CAF50',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#4CAF50dd' },
            }}
          >
            Entendido, Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
