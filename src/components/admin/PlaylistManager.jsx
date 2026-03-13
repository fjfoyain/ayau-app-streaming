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
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { getUserPlaylists, createPlaylist, updatePlaylist, deletePlaylist, uploadPlaylistCover, deleteStorageFile, getPlaylistSongs, bulkAddSongsToPlaylist, removeSongFromPlaylist } from '../../services/supabase-api';

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
  const dupFileInputRef = useRef(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicatingPlaylist, setDuplicatingPlaylist] = useState(null);
  const [dupName, setDupName] = useState('');
  const [dupCoverFile, setDupCoverFile] = useState(null);
  const [dupCoverPreview, setDupCoverPreview] = useState(null);
  const [dupKeepCover, setDupKeepCover] = useState(true);
  const [editingPlaylistSongs, setEditingPlaylistSongs] = useState([]);
  const [removedSongIds, setRemovedSongIds] = useState(new Set());
  const [loadingSongs, setLoadingSongs] = useState(false);

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
      setCoverPreview(playlist.cover_image_url && /^https?:\/\//i.test(playlist.cover_image_url)
        ? playlist.cover_image_url
        : null);
      setEditingPlaylistSongs([]);
      setRemovedSongIds(new Set());
      setLoadingSongs(true);
      getPlaylistSongs(playlist.id)
        .then(songs => setEditingPlaylistSongs(songs))
        .catch(() => {})
        .finally(() => setLoadingSongs(false));
    } else {
      setEditingPlaylist(null);
      setFormData({ name: '', description: '', cover_image_url: '', is_public: false });
      setCoverPreview(null);
      setEditingPlaylistSongs([]);
      setRemovedSongIds(new Set());
    }
    setCoverFile(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPlaylist(null);
    setCoverFile(null);
    setCoverPreview(null);
    setEditingPlaylistSongs([]);
    setRemovedSongIds(new Set());
  };

  const handleToggleRemoveSong = (songId) => {
    setRemovedSongIds(prev => {
      const next = new Set(prev);
      next.has(songId) ? next.delete(songId) : next.add(songId);
      return next;
    });
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

        // Remove unchecked songs
        for (const songId of removedSongIds) {
          await removeSongFromPlaylist(editingPlaylist.id, songId);
        }
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

  const handleOpenDuplicateDialog = (playlist) => {
    setDuplicatingPlaylist(playlist);
    setDupName(`Copia de ${playlist.name}`);
    setDupKeepCover(true);
    setDupCoverFile(null);
    const preview = playlist.cover_image_url && /^https?:\/\//i.test(playlist.cover_image_url)
      ? playlist.cover_image_url : null;
    setDupCoverPreview(preview);
    setDuplicateDialogOpen(true);
  };

  const handleCloseDuplicateDialog = () => {
    setDuplicateDialogOpen(false);
    setDuplicatingPlaylist(null);
    setDupCoverFile(null);
    setDupCoverPreview(null);
  };

  const handleDupCoverFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDupCoverFile(file);
    setDupCoverPreview(URL.createObjectURL(file));
    setDupKeepCover(false);
  };

  const handleDuplicatePlaylist = async () => {
    if (!dupName.trim() || !duplicatingPlaylist) return;
    setUploading(true);
    try {
      // 1. Create new playlist (same description and visibility, new name)
      const newPlaylist = await createPlaylist({
        name: dupName.trim(),
        description: duplicatingPlaylist.description || '',
        cover_image_url: '',
        is_public: duplicatingPlaylist.is_public,
      });

      // 2. Handle cover image
      if (dupCoverFile) {
        const coverPath = await uploadPlaylistCover(dupCoverFile, newPlaylist.id);
        await updatePlaylist(newPlaylist.id, { cover_image_url: coverPath });
      } else if (dupKeepCover && duplicatingPlaylist.cover_image_url) {
        await updatePlaylist(newPlaylist.id, { cover_image_url: duplicatingPlaylist.cover_image_url });
      }

      // 3. Copy songs in order
      const sourceSongs = await getPlaylistSongs(duplicatingPlaylist.id);
      if (sourceSongs.length > 0) {
        const songIds = sourceSongs.map(s => s.id);
        await bulkAddSongsToPlaylist(newPlaylist.id, songIds, 1);
      }

      handleCloseDuplicateDialog();
      fetchPlaylists();
    } catch (error) {
      console.error('Error duplicating playlist:', error);
      alert('Error al duplicar la playlist: ' + error.message);
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
                  <Tooltip title="Duplicar playlist">
                    <IconButton onClick={() => handleOpenDuplicateDialog(playlist)} sx={{ color: '#4CAF50' }}>
                      <ContentCopyIcon />
                    </IconButton>
                  </Tooltip>
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

          {/* Songs list (edit mode only) */}
          {editingPlaylist && (
            <>
              <Divider sx={{ borderColor: '#F4D03F22', my: 2 }} />
              <Typography variant="subtitle2" sx={{ color: '#F4D03F', mb: 1 }}>
                Canciones en la playlist
                {removedSongIds.size > 0 && (
                  <Typography component="span" variant="caption" sx={{ color: '#ff5252', ml: 1 }}>
                    ({removedSongIds.size} se eliminarán al guardar)
                  </Typography>
                )}
              </Typography>
              {loadingSongs ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} sx={{ color: '#F4D03F' }} />
                </Box>
              ) : editingPlaylistSongs.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#F4D03F44', fontStyle: 'italic' }}>
                  Esta playlist no tiene canciones.
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #F4D03F22', borderRadius: '8px' }}>
                  {editingPlaylistSongs.map((song) => {
                    const removed = removedSongIds.has(song.id);
                    return (
                      <Box
                        key={song.id}
                        onClick={() => handleToggleRemoveSong(song.id)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          px: 1.5, py: 0.75, cursor: 'pointer',
                          borderBottom: '1px solid #F4D03F11',
                          backgroundColor: removed ? '#ff525210' : 'transparent',
                          '&:hover': { backgroundColor: removed ? '#ff525220' : '#F4D03F0A' },
                          '&:last-child': { borderBottom: 'none' },
                        }}
                      >
                        <Checkbox
                          checked={!removed}
                          onChange={() => handleToggleRemoveSong(song.id)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                          sx={{ color: '#F4D03F44', '&.Mui-checked': { color: '#F4D03F' }, p: 0.5 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{ color: removed ? '#ffffff44' : '#F4D03F', textDecoration: removed ? 'line-through' : 'none', lineHeight: 1.3 }}
                            noWrap
                          >
                            {song.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: removed ? '#ffffff22' : '#F4D03F66' }} noWrap>
                            {song.performer}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </>
          )}
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
      {/* Dialog for Duplicate Playlist */}
      <Dialog
        open={duplicateDialogOpen}
        onClose={uploading ? undefined : handleCloseDuplicateDialog}
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
          Duplicar Playlist
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#F4D03F99', mb: 2 }}>
            Crea una copia de <strong style={{ color: '#F4D03F' }}>{duplicatingPlaylist?.name}</strong> con todas sus canciones.
          </Typography>

          <TextField
            autoFocus
            margin="dense"
            label="Nombre de la nueva playlist"
            fullWidth
            variant="outlined"
            value={dupName}
            onChange={(e) => setDupName(e.target.value)}
            sx={inputSx}
          />

          {/* Cover image section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#F4D03F99', display: 'block', mb: 1 }}>
              Imagen de Portada
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {dupCoverPreview && (
                <Box
                  component="img"
                  src={dupCoverPreview}
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
              {!dupCoverPreview && duplicatingPlaylist?.cover_image_url && dupKeepCover && (
                <Typography variant="caption" sx={{ color: '#4CAF50' }}>
                  Usando imagen original
                </Typography>
              )}
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => dupFileInputRef.current?.click()}
                disabled={uploading}
                sx={{
                  color: '#F4D03F',
                  borderColor: '#F4D03F44',
                  fontSize: '0.8rem',
                  '&:hover': { borderColor: '#F4D03F', backgroundColor: '#F4D03F11' },
                }}
              >
                {dupCoverFile ? 'Cambiar imagen' : 'Subir nueva imagen'}
              </Button>
              {dupCoverFile && (
                <Button
                  size="small"
                  onClick={() => {
                    setDupCoverFile(null);
                    setDupCoverPreview(
                      duplicatingPlaylist?.cover_image_url && /^https?:\/\//i.test(duplicatingPlaylist.cover_image_url)
                        ? duplicatingPlaylist.cover_image_url : null
                    );
                    setDupKeepCover(true);
                  }}
                  sx={{ color: '#F4D03F66', fontSize: '0.8rem', '&:hover': { color: '#F4D03F' } }}
                >
                  Usar original
                </Button>
              )}
            </Box>
            <input
              ref={dupFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleDupCoverFileChange}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDuplicateDialog} sx={{ color: '#F4D03F' }} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleDuplicatePlaylist}
            variant="contained"
            disabled={uploading || !dupName.trim()}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#F4D03Fdd' },
              '&:disabled': { backgroundColor: '#F4D03F44', color: '#00000088' },
            }}
          >
            {uploading ? <CircularProgress size={20} sx={{ color: '#000' }} /> : 'Duplicar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
