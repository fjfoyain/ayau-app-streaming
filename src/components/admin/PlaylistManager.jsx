import { useState, useEffect, useRef } from 'react';
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
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { getUserPlaylists, createPlaylist, updatePlaylist, deletePlaylist, uploadPlaylistCover, deleteStorageFile } from '../../services/supabase-api';

export default function PlaylistManager() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cover_image_url: '',
    is_public: false,
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const data = await getUserPlaylists();
      setPlaylists(data);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (playlist = null) => {
    if (playlist) {
      setEditingPlaylist(playlist);
      setFormData({
        name: playlist.name,
        description: playlist.description || '',
        cover_image_url: playlist.cover_image_url || '',
        is_public: playlist.is_public,
      });
      // Show existing cover as preview if it's an http URL (already signed)
      setCoverPreview(playlist.cover_image_url && /^https?:\/\//i.test(playlist.cover_image_url)
        ? playlist.cover_image_url
        : null);
    } else {
      setEditingPlaylist(null);
      setFormData({ name: '', description: '', cover_image_url: '', is_public: false });
      setCoverPreview(null);
    }
    setCoverFile(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlaylist(null);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleCoverFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setUploading(true);
    try {
      if (editingPlaylist) {
        let updates = { ...formData };

        if (coverFile) {
          // Delete old storage file if it was a storage path
          if (editingPlaylist.cover_image_url && !/^https?:\/\//i.test(editingPlaylist.cover_image_url)) {
            await deleteStorageFile(editingPlaylist.cover_image_url);
          }
          const newPath = await uploadPlaylistCover(coverFile, editingPlaylist.id);
          updates.cover_image_url = newPath;
        }

        await updatePlaylist(editingPlaylist.id, updates);
      } else {
        const newPlaylist = await createPlaylist(formData);

        if (coverFile) {
          const coverPath = await uploadPlaylistCover(coverFile, newPlaylist.id);
          await updatePlaylist(newPlaylist.id, { cover_image_url: coverPath });
        }
      }

      handleCloseDialog();
      fetchPlaylists();
    } catch (error) {
      console.error('Error saving playlist:', error);
      alert('Error al guardar la playlist');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (playlistId) => {
    if (!confirm('¿Estás seguro de eliminar esta playlist?')) return;

    try {
      const playlist = playlists.find(p => p.id === playlistId);
      await deletePlaylist(playlistId);

      // Delete cover from storage if it's a storage path
      if (playlist?.cover_image_url && !/^https?:\/\//i.test(playlist.cover_image_url)) {
        await deleteStorageFile(playlist.cover_image_url);
      }

      fetchPlaylists();
    } catch (error) {
      console.error('Error deleting playlist:', error);
      alert('Error al eliminar la playlist');
    }
  };

  const inputSx = {
    mb: 2,
    '& .MuiOutlinedInput-root': {
      color: '#F4D03F',
      '& fieldset': { borderColor: '#F4D03F44' },
      '&:hover fieldset': { borderColor: '#F4D03F' },
      '&.Mui-focused fieldset': { borderColor: '#F4D03F' },
    },
    '& .MuiInputLabel-root': { color: '#F4D03F99' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#F4D03F' },
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
          Gestión de Playlists
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{
            backgroundColor: '#F4D03F',
            color: '#000',
            fontWeight: 'bold',
            '&:hover': { backgroundColor: '#F4D03Fdd' },
          }}
        >
          Nueva Playlist
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
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Descripción</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Pública</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {playlists.map((playlist) => (
              <TableRow
                key={playlist.id}
                sx={{
                  '&:hover': { backgroundColor: '#F4D03F11' },
                  borderBottom: '1px solid #F4D03F22',
                }}
              >
                <TableCell sx={{ color: '#F4D03F' }}>{playlist.name}</TableCell>
                <TableCell sx={{ color: '#F4D03F99' }}>{playlist.description || '-'}</TableCell>
                <TableCell align="center">
                  {playlist.is_public ? (
                    <CheckCircleIcon sx={{ color: '#4CAF50' }} />
                  ) : (
                    <CancelIcon sx={{ color: '#F4D03F44' }} />
                  )}
                </TableCell>
                <TableCell align="center">
                  <IconButton onClick={() => handleOpenDialog(playlist)} sx={{ color: '#F4D03F' }}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(playlist.id)} sx={{ color: '#F4D03F' }}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog for Create/Edit */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
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
          {editingPlaylist ? 'Editar Playlist' : 'Nueva Playlist'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nombre"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={inputSx}
          />
          <TextField
            margin="dense"
            label="Descripción"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            sx={inputSx}
          />

          {/* Cover image upload */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#F4D03F99', display: 'block', mb: 1 }}>
              Imagen de Portada
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {coverPreview && (
                <Box
                  component="img"
                  src={coverPreview}
                  alt="preview"
                  sx={{
                    width: 80,
                    height: 80,
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #F4D03F44',
                  }}
                />
              )}
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  color: '#F4D03F',
                  borderColor: '#F4D03F44',
                  '&:hover': { borderColor: '#F4D03F', backgroundColor: '#F4D03F11' },
                }}
              >
                {coverPreview ? 'Cambiar imagen' : 'Subir imagen'}
              </Button>
              {coverPreview && (
                <Button
                  size="small"
                  onClick={() => { setCoverFile(null); setCoverPreview(null); setFormData({ ...formData, cover_image_url: '' }); }}
                  sx={{ color: '#F4D03F66', '&:hover': { color: '#F4D03F' } }}
                >
                  Quitar
                </Button>
              )}
            </Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleCoverFileChange}
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#F4D03F' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#F4D03F' },
                }}
              />
            }
            label="Playlist Pública"
            sx={{ color: '#F4D03F', mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog} sx={{ color: '#F4D03F' }} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={uploading || !formData.name.trim()}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#F4D03Fdd' },
              '&:disabled': { backgroundColor: '#F4D03F44', color: '#00000088' },
            }}
          >
            {uploading ? <CircularProgress size={20} sx={{ color: '#000' }} /> : (editingPlaylist ? 'Guardar' : 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
