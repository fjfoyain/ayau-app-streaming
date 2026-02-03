import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import {
  getAccountPlaylists,
  getAllPlaylistsForAssignment,
  assignPlaylistToAccount,
  removePlaylistFromAccount,
} from '../../services/supabase-api';

export default function AccountPlaylistManager({ account, open, onClose }) {
  const [playlists, setPlaylists] = useState([]);
  const [assignedPlaylists, setAssignedPlaylists] = useState([]);
  const [availablePlaylists, setAvailablePlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && account) {
      fetchData();
    }
  }, [open, account]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allPlaylists, accountPlaylists] = await Promise.all([
        getAllPlaylistsForAssignment(),
        getAccountPlaylists(account.id),
      ]);

      setPlaylists(allPlaylists || []);
      setAssignedPlaylists(accountPlaylists || []);

      // Filter available playlists (not yet assigned)
      const assignedIds = new Set((accountPlaylists || []).map(p => p.id));
      const available = (allPlaylists || []).filter(p => !assignedIds.has(p.id));
      setAvailablePlaylists(available);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      alert('Error al cargar playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPlaylist = async () => {
    if (!selectedPlaylist) return;

    setSaving(true);
    try {
      await assignPlaylistToAccount(account.id, selectedPlaylist);
      alert('Playlist asignada exitosamente');
      setSelectedPlaylist('');
      await fetchData();
    } catch (error) {
      console.error('Error assigning playlist:', error);
      alert('Error al asignar playlist: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlaylist = async (playlistId) => {
    if (!confirm('¿Remover esta playlist de la cuenta? También se removerá de todos los locales.')) return;

    setSaving(true);
    try {
      await removePlaylistFromAccount(account.id, playlistId);
      alert('Playlist removida exitosamente');
      await fetchData();
    } catch (error) {
      console.error('Error removing playlist:', error);
      alert('Error al remover playlist: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
      <DialogTitle sx={{ color: '#F4D03F', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
        <QueueMusicIcon />
        Playlists de {account?.name}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress sx={{ color: '#F4D03F' }} />
          </Box>
        ) : (
          <>
            {/* Assigned Playlists */}
            <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
              Playlists Asignadas ({assignedPlaylists.length})
            </Typography>
            {assignedPlaylists.length === 0 ? (
              <Typography sx={{ color: '#F4D03F66', mb: 3, fontStyle: 'italic' }}>
                No hay playlists asignadas a esta cuenta
              </Typography>
            ) : (
              <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {assignedPlaylists.map((playlist) => (
                  <Chip
                    key={playlist.id}
                    label={`${playlist.name} (${playlist.song_count || 0} canciones)`}
                    onDelete={() => handleRemovePlaylist(playlist.id)}
                    disabled={saving}
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

            {/* Assign New Playlist */}
            <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
              Asignar Nueva Playlist
            </Typography>
            {availablePlaylists.length === 0 ? (
              <Typography sx={{ color: '#F4D03F66', mb: 3, fontStyle: 'italic' }}>
                Todas las playlists ya están asignadas
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <FormControl fullWidth>
                  <InputLabel sx={{ color: '#F4D03F99', '&.Mui-focused': { color: '#F4D03F' } }}>
                    Seleccionar Playlist
                  </InputLabel>
                  <Select
                    value={selectedPlaylist}
                    onChange={(e) => setSelectedPlaylist(e.target.value)}
                    disabled={saving}
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
                    {availablePlaylists.map((playlist) => (
                      <MenuItem key={playlist.id} value={playlist.id}>
                        {playlist.name} {playlist.is_public && '(Pública)'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  onClick={handleAssignPlaylist}
                  disabled={!selectedPlaylist || saving}
                  startIcon={<AddIcon />}
                  sx={{
                    backgroundColor: '#F4D03F',
                    color: '#000',
                    fontWeight: 'bold',
                    minWidth: '140px',
                    '&:hover': { backgroundColor: '#F4D03Fdd' },
                    '&:disabled': { backgroundColor: '#F4D03F44', color: '#00000088' },
                  }}
                >
                  {saving ? 'Asignando...' : 'Asignar'}
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{ color: '#F4D03F' }}
        >
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
