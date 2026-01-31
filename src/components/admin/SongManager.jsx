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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { parseBlob } from 'music-metadata';
import {
  getAllSongs,
  createSong,
  updateSong,
  deleteSong,
  getUserPlaylists,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylistSongs,
  uploadAudioFile,
  uploadCoverImage,
  getSongPlaylists,
} from '../../services/supabase-api';

export default function SongManager() {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [currentSongPlaylists, setCurrentSongPlaylists] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, status: '' });
  const [bulkResults, setBulkResults] = useState({ success: [], failed: [] });
  const [formData, setFormData] = useState({
    title: '',
    performer: '',
    author: '',
    duration: 0,
    file_url: '',
    cover_image_url: '',
    isrc: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [songsData, playlistsData] = await Promise.all([
        getAllSongs(),
        getUserPlaylists(),
      ]);
      setSongs(songsData);
      setPlaylists(playlistsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setAudioFile(file);
    setUploading(true);

    try {
      // Extract metadata from audio file
      const metadata = await parseBlob(file);

      // Extract and prepare cover image if available
      let coverDataUrl = '';
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        try {
          const picture = metadata.common.picture[0];
          const blob = new Blob([picture.data], { type: picture.format });

          // Convert to data URL for preview
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(blob);
          });
          coverDataUrl = dataUrl;

          // Store the cover file for upload later
          const coverFile = new File([blob], `cover.${picture.format.split('/')[1]}`, {
            type: picture.format,
          });
          window.tempCoverFile = coverFile;
        } catch (coverError) {
          console.error('Could not extract cover:', coverError);
          coverDataUrl = ''; // Ensure it's empty on error
        }
      }

      // Update form with extracted metadata
      // Handle ISRC - it might be a string, array, or other type
      let isrcValue = '';
      if (metadata.common.isrc) {
        if (Array.isArray(metadata.common.isrc)) {
          isrcValue = String(metadata.common.isrc[0] || '').substring(0, 12);
        } else {
          isrcValue = String(metadata.common.isrc).substring(0, 12);
        }
      }

      setFormData(prev => ({
        ...prev,
        title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ''),
        performer: metadata.common.artist || '',
        author: metadata.common.composer || metadata.common.albumartist || '',
        duration: Math.floor(metadata.format.duration || 0),
        isrc: isrcValue,
        cover_image_url: coverDataUrl, // Preview data URL (will be uploaded on submit)
      }));

      const coverMsg = coverDataUrl ? ' y cover' : '';
      alert(`Metadata${coverMsg} extraídos exitosamente!`);
    } catch (error) {
      console.error('Error extracting metadata:', error);
      alert('No se pudo extraer metadata. Ingresa los datos manualmente.');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDialog = (song = null) => {
    if (song) {
      setEditingSong(song);
      setFormData({
        title: song.title,
        performer: song.performer,
        author: song.author || '',
        duration: song.duration,
        file_url: song.file_url,
        cover_image_url: song.cover_image_url || '',
        isrc: song.isrc || '',
      });
    } else {
      setEditingSong(null);
      setAudioFile(null);
      setFormData({
        title: '',
        performer: '',
        author: '',
        duration: 0,
        file_url: '',
        cover_image_url: '',
        isrc: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSong(null);
    setAudioFile(null);
    window.tempCoverFile = null; // Clean up temp cover file
  };

  const handleSubmit = async () => {
    setUploading(true);
    try {
      let finalFormData = { ...formData };

      if (editingSong) {
        // Update existing song
        if (audioFile) {
          const audioUrl = await uploadAudioFile(audioFile, editingSong.id);
          finalFormData.file_url = audioUrl;
        }
        await updateSong(editingSong.id, finalFormData);
      } else {
        // Create new song
        if (!audioFile && !formData.file_url) {
          alert('Debes seleccionar un archivo de audio o ingresar una URL');
          setUploading(false);
          return;
        }

        // First create the song to get an ID
        const newSong = await createSong(finalFormData);

        // Upload audio and cover files
        const updates = {};

        // If there's an audio file, upload it
        if (audioFile) {
          const audioUrl = await uploadAudioFile(audioFile, newSong.id);
          updates.file_url = audioUrl;
        }

        // If there's a cover extracted from MP3, upload it
        if (window.tempCoverFile) {
          try {
            const coverUrl = await uploadCoverImage(window.tempCoverFile, newSong.id);
            updates.cover_image_url = coverUrl;
            window.tempCoverFile = null; // Clean up
          } catch (coverError) {
            console.warn('Could not upload cover:', coverError);
          }
        }

        // Update song with file URLs
        if (Object.keys(updates).length > 0) {
          await updateSong(newSong.id, updates);
        }
      }

      alert('Canción guardada exitosamente!');
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving song:', error);
      alert('Error al guardar la canción: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (songId) => {
    if (!confirm('¿Estás seguro de eliminar esta canción?')) return;

    try {
      await deleteSong(songId);
      fetchData();
    } catch (error) {
      console.error('Error deleting song:', error);
      alert('Error al eliminar la canción');
    }
  };

  const handleOpenPlaylistDialog = async (song) => {
    setSelectedSong(song);
    setPlaylistDialogOpen(true);

    try {
      // Get playlists where this song already is
      const songPlaylists = await getSongPlaylists(song.id);
      const playlistIds = songPlaylists.map(p => p.id);
      setCurrentSongPlaylists(playlistIds);
      setSelectedPlaylists(playlistIds);
    } catch (error) {
      console.error('Error fetching song playlists:', error);
      setCurrentSongPlaylists([]);
      setSelectedPlaylists([]);
    }
  };

  const handleClosePlaylistDialog = () => {
    setPlaylistDialogOpen(false);
    setSelectedSong(null);
    setSelectedPlaylists([]);
    setCurrentSongPlaylists([]);
  };

  const handleTogglePlaylist = (playlistId) => {
    setSelectedPlaylists(prev =>
      prev.includes(playlistId)
        ? prev.filter(id => id !== playlistId)
        : [...prev, playlistId]
    );
  };

  const handleSavePlaylists = async () => {
    if (!selectedSong) return;

    setUploading(true);
    try {
      // Determine which playlists to add and remove
      const toAdd = selectedPlaylists.filter(id => !currentSongPlaylists.includes(id));
      const toRemove = currentSongPlaylists.filter(id => !selectedPlaylists.includes(id));

      // Add to new playlists
      for (const playlistId of toAdd) {
        const playlistSongs = await getPlaylistSongs(playlistId);
        const position = playlistSongs.length + 1;
        await addSongToPlaylist(playlistId, selectedSong.id, position);
      }

      // Remove from old playlists
      for (const playlistId of toRemove) {
        await removeSongFromPlaylist(playlistId, selectedSong.id);
      }

      alert('Playlists actualizadas exitosamente!');
      handleClosePlaylistDialog();
    } catch (error) {
      console.error('Error updating playlists:', error);
      alert('Error al actualizar las playlists: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBulkFilesSelect = (event) => {
    const files = Array.from(event.target.files);
    setBulkFiles(files);
    setBulkResults({ success: [], failed: [] });
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      alert('Selecciona al menos un archivo');
      return;
    }

    setUploading(true);
    setBulkProgress({ current: 0, total: bulkFiles.length, status: 'Iniciando...' });
    const results = { success: [], failed: [] };

    for (let i = 0; i < bulkFiles.length; i++) {
      const file = bulkFiles[i];
      setBulkProgress({
        current: i + 1,
        total: bulkFiles.length,
        status: `Procesando: ${file.name}`,
      });

      try {
        // Extract metadata
        const metadata = await parseBlob(file);

        // Extract and upload cover image if available
        let coverUrl = '';
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          try {
            const picture = metadata.common.picture[0];
            const coverBlob = new Blob([picture.data], { type: picture.format });
            const coverFile = new File([coverBlob], `cover.${picture.format.split('/')[1]}`, {
              type: picture.format,
            });

            // Generate temporary ID for cover (will use song ID after creation)
            const tempId = `temp_${Date.now()}`;
            const tempCoverUrl = await uploadCoverImage(coverFile, tempId);
            coverUrl = tempCoverUrl;
          } catch (coverError) {
            console.warn(`Could not extract cover for ${file.name}:`, coverError);
          }
        }

        // Handle ISRC - it might be a string, array, or other type
        let isrcValue = '';
        if (metadata.common.isrc) {
          if (Array.isArray(metadata.common.isrc)) {
            isrcValue = String(metadata.common.isrc[0] || '').substring(0, 12);
          } else {
            isrcValue = String(metadata.common.isrc).substring(0, 12);
          }
        }

        // Prepare song data
        const songData = {
          title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ''),
          performer: metadata.common.artist || 'Desconocido',
          author: metadata.common.composer || metadata.common.albumartist || '',
          duration: Math.floor(metadata.format.duration || 0),
          isrc: isrcValue,
          file_url: '', // Will be updated after upload
          cover_image_url: coverUrl,
        };

        // Create song in database
        const newSong = await createSong(songData);

        // Upload audio file
        const audioUrl = await uploadAudioFile(file, newSong.id);

        // Upload cover with correct song ID if we have one
        if (coverUrl && coverUrl.includes('temp_')) {
          try {
            const picture = metadata.common.picture[0];
            const coverBlob = new Blob([picture.data], { type: picture.format });
            const coverFile = new File([coverBlob], `cover.${picture.format.split('/')[1]}`, {
              type: picture.format,
            });
            coverUrl = await uploadCoverImage(coverFile, newSong.id);
          } catch (coverError) {
            console.warn(`Could not re-upload cover for ${file.name}:`, coverError);
          }
        }

        // Update song with file URL and final cover URL
        await updateSong(newSong.id, {
          file_url: audioUrl,
          ...(coverUrl && { cover_image_url: coverUrl })
        });

        results.success.push({
          name: file.name,
          title: songData.title,
          id: newSong.id,
        });
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        results.failed.push({
          name: file.name,
          error: error.message,
        });
      }
    }

    setBulkResults(results);
    setBulkProgress({
      current: bulkFiles.length,
      total: bulkFiles.length,
      status: 'Completado',
    });
    setUploading(false);

    // Refresh song list
    fetchData();
  };

  const handleCloseBulkDialog = () => {
    setBulkUploadDialogOpen(false);
    setBulkFiles([]);
    setBulkProgress({ current: 0, total: 0, status: '' });
    setBulkResults({ success: [], failed: [] });
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
          Gestión de Canciones
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setBulkUploadDialogOpen(true)}
            sx={{
              color: '#F4D03F',
              borderColor: '#F4D03F',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: '#F4D03F22',
                borderColor: '#F4D03F',
              },
            }}
          >
            Carga Bulk
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': {
                backgroundColor: '#F4D03Fdd',
              },
            }}
          >
            Nueva Canción
          </Button>
        </Box>
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
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Título</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Artista</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }}>Autor</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Duración</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">ISRC</TableCell>
              <TableCell sx={{ color: '#F4D03F', fontWeight: 'bold' }} align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {songs.map((song) => (
              <TableRow
                key={song.id}
                sx={{
                  '&:hover': { backgroundColor: '#F4D03F11' },
                  borderBottom: '1px solid #F4D03F22',
                }}
              >
                <TableCell sx={{ color: '#F4D03F' }}>{song.title}</TableCell>
                <TableCell sx={{ color: '#F4D03F99' }}>{song.performer}</TableCell>
                <TableCell sx={{ color: '#F4D03F99' }}>{song.author || '-'}</TableCell>
                <TableCell align="center" sx={{ color: '#F4D03F99' }}>
                  {formatDuration(song.duration)}
                </TableCell>
                <TableCell align="center" sx={{ color: '#F4D03F99', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {song.isrc || '-'}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={() => handleOpenPlaylistDialog(song)}
                    sx={{ color: '#4CAF50' }}
                    title="Gestionar playlists"
                  >
                    <PlaylistAddIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleOpenDialog(song)}
                    sx={{ color: '#F4D03F' }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(song.id)}
                    sx={{ color: '#F4D03F' }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog for Create/Edit Song */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
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
          {editingSong ? 'Editar Canción' : 'Nueva Canción'}
        </DialogTitle>
        <DialogContent>
          {/* File Upload Section */}
          <Paper
            sx={{
              p: 3,
              mb: 3,
              mt: 2,
              backgroundColor: '#F4D03F11',
              border: '2px dashed #F4D03F44',
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <Button
              component="label"
              variant="contained"
              startIcon={<CloudUploadIcon />}
              sx={{
                backgroundColor: '#F4D03F',
                color: '#000',
                fontWeight: 'bold',
                mb: 2,
                '&:hover': { backgroundColor: '#F4D03Fdd' },
              }}
            >
              {audioFile ? 'Cambiar Archivo' : 'Seleccionar Archivo de Audio'}
              <input
                type="file"
                hidden
                accept="audio/*"
                onChange={handleFileSelect}
              />
            </Button>
            {audioFile && (
              <Typography sx={{ color: '#F4D03F', fontSize: '0.9rem' }}>
                Archivo: <strong>{audioFile.name}</strong>
              </Typography>
            )}
            {uploading && <LinearProgress sx={{ mt: 2, '& .MuiLinearProgress-bar': { backgroundColor: '#F4D03F' } }} />}
            <Typography sx={{ color: '#F4D03F99', fontSize: '0.85rem', mt: 2 }}>
              La metadata se extraerá automáticamente del archivo
            </Typography>
          </Paper>

          {/* Form Fields */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Título"
              fullWidth
              variant="outlined"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
              label="Artista/Intérprete"
              fullWidth
              variant="outlined"
              value={formData.performer}
              onChange={(e) => setFormData({ ...formData, performer: e.target.value })}
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
              label="Autor/Compositor"
              fullWidth
              variant="outlined"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
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
              label="Duración (segundos)"
              type="number"
              fullWidth
              variant="outlined"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
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
              label="URL del Archivo de Audio (opcional si subes archivo)"
              fullWidth
              variant="outlined"
              value={formData.file_url}
              onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
              sx={{
                gridColumn: '1 / -1',
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
              label="URL de Imagen de Portada"
              fullWidth
              variant="outlined"
              value={formData.cover_image_url}
              onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
              sx={{
                gridColumn: '1 / -1',
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
              label="ISRC (Código Internacional)"
              fullWidth
              variant="outlined"
              value={formData.isrc}
              onChange={(e) => setFormData({ ...formData, isrc: e.target.value })}
              sx={{
                gridColumn: '1 / -1',
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog} sx={{ color: '#F4D03F' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={uploading}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#F4D03Fdd' },
              '&:disabled': { backgroundColor: '#F4D03F33', color: '#00000099' },
            }}
          >
            {uploading ? 'Guardando...' : (editingSong ? 'Guardar' : 'Crear')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Managing Playlists (with checkboxes) */}
      <Dialog
        open={playlistDialogOpen}
        onClose={handleClosePlaylistDialog}
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
          Gestionar Playlists
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#F4D03F99', mb: 3 }}>
            Canción: <strong style={{ color: '#F4D03F' }}>{selectedSong?.title}</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: '#F4D03F99', mb: 2 }}>
            Selecciona las playlists donde quieres que aparezca esta canción:
          </Typography>
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {playlists.map((playlist) => (
              <FormControlLabel
                key={playlist.id}
                control={
                  <Checkbox
                    checked={selectedPlaylists.includes(playlist.id)}
                    onChange={() => handleTogglePlaylist(playlist.id)}
                    sx={{
                      color: '#F4D03F44',
                      '&.Mui-checked': { color: '#F4D03F' },
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ color: '#F4D03F' }}>{playlist.name}</Typography>
                    {currentSongPlaylists.includes(playlist.id) && (
                      <Typography variant="caption" sx={{ color: '#4CAF50' }}>
                        (Ya está en esta playlist)
                      </Typography>
                    )}
                  </Box>
                }
                sx={{
                  width: '100%',
                  mb: 1,
                  p: 1.5,
                  borderRadius: '8px',
                  border: selectedPlaylists.includes(playlist.id) ? '2px solid #F4D03F' : '2px solid #F4D03F22',
                  backgroundColor: selectedPlaylists.includes(playlist.id) ? '#F4D03F11' : 'transparent',
                  '&:hover': {
                    backgroundColor: '#F4D03F11',
                    border: '2px solid #F4D03F44',
                  },
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClosePlaylistDialog} sx={{ color: '#F4D03F' }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSavePlaylists}
            variant="contained"
            disabled={uploading}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#F4D03Fdd' },
              '&:disabled': { backgroundColor: '#F4D03F33', color: '#00000099' },
            }}
          >
            {uploading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for Bulk Upload */}
      <Dialog
        open={bulkUploadDialogOpen}
        onClose={uploading ? undefined : handleCloseBulkDialog}
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
          Carga Bulk de Canciones
        </DialogTitle>
        <DialogContent>
          <Paper
            sx={{
              p: 3,
              mb: 3,
              mt: 2,
              backgroundColor: '#F4D03F11',
              border: '2px dashed #F4D03F44',
              borderRadius: '12px',
              textAlign: 'center',
            }}
          >
            <Button
              component="label"
              variant="contained"
              startIcon={<UploadFileIcon />}
              disabled={uploading}
              sx={{
                backgroundColor: '#F4D03F',
                color: '#000',
                fontWeight: 'bold',
                mb: 2,
                '&:hover': { backgroundColor: '#F4D03Fdd' },
                '&:disabled': { backgroundColor: '#F4D03F33', color: '#00000099' },
              }}
            >
              Seleccionar Archivos de Audio
              <input
                type="file"
                hidden
                multiple
                accept="audio/*"
                onChange={handleBulkFilesSelect}
                disabled={uploading}
              />
            </Button>
            {bulkFiles.length > 0 && (
              <Typography sx={{ color: '#F4D03F', fontSize: '0.9rem' }}>
                <strong>{bulkFiles.length}</strong> archivos seleccionados
              </Typography>
            )}
            <Typography sx={{ color: '#F4D03F99', fontSize: '0.85rem', mt: 2 }}>
              Selecciona múltiples archivos de audio. La metadata se extraerá automáticamente de cada archivo.
            </Typography>
          </Paper>

          {/* File List */}
          {bulkFiles.length > 0 && (
            <Paper
              sx={{
                p: 2,
                mb: 3,
                backgroundColor: '#000',
                border: '2px solid #F4D03F44',
                borderRadius: '12px',
                maxHeight: 300,
                overflowY: 'auto',
              }}
            >
              <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                Archivos a Procesar:
              </Typography>
              {bulkFiles.map((file, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    borderRadius: '8px',
                    backgroundColor: '#F4D03F11',
                    border: '1px solid #F4D03F22',
                  }}
                >
                  <Typography sx={{ color: '#F4D03F', fontSize: '0.9rem' }}>
                    {index + 1}. {file.name}
                  </Typography>
                  <Typography sx={{ color: '#F4D03F99', fontSize: '0.8rem' }}>
                    Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                </Box>
              ))}
            </Paper>
          )}

          {/* Progress */}
          {uploading && (
            <Paper
              sx={{
                p: 3,
                mb: 3,
                backgroundColor: '#F4D03F11',
                border: '2px solid #F4D03F',
                borderRadius: '12px',
              }}
            >
              <Typography sx={{ color: '#F4D03F', mb: 2, fontWeight: 'bold' }}>
                Progreso: {bulkProgress.current} / {bulkProgress.total}
              </Typography>
              <Typography sx={{ color: '#F4D03F99', mb: 2, fontSize: '0.9rem' }}>
                {bulkProgress.status}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(bulkProgress.current / bulkProgress.total) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#F4D03F22',
                  '& .MuiLinearProgress-bar': { backgroundColor: '#F4D03F' },
                }}
              />
            </Paper>
          )}

          {/* Results */}
          {bulkResults.success.length > 0 || bulkResults.failed.length > 0 ? (
            <Paper
              sx={{
                p: 3,
                backgroundColor: '#000',
                border: '2px solid #F4D03F',
                borderRadius: '12px',
              }}
            >
              <Typography variant="h6" sx={{ color: '#F4D03F', mb: 2 }}>
                Resultados de la Carga
              </Typography>

              {bulkResults.success.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ color: '#4CAF50', fontWeight: 'bold', mb: 1 }}>
                    ✓ Exitosas ({bulkResults.success.length}):
                  </Typography>
                  {bulkResults.success.map((item, index) => (
                    <Typography key={index} sx={{ color: '#F4D03F99', fontSize: '0.85rem', ml: 2 }}>
                      • {item.title} ({item.name})
                    </Typography>
                  ))}
                </Box>
              )}

              {bulkResults.failed.length > 0 && (
                <Box>
                  <Typography sx={{ color: '#F44336', fontWeight: 'bold', mb: 1 }}>
                    ✗ Fallidas ({bulkResults.failed.length}):
                  </Typography>
                  {bulkResults.failed.map((item, index) => (
                    <Box key={index} sx={{ ml: 2, mb: 1 }}>
                      <Typography sx={{ color: '#F4D03F99', fontSize: '0.85rem' }}>
                        • {item.name}
                      </Typography>
                      <Typography sx={{ color: '#F4D03F66', fontSize: '0.75rem', ml: 2 }}>
                        Error: {item.error}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={handleCloseBulkDialog}
            disabled={uploading}
            sx={{ color: '#F4D03F' }}
          >
            {uploading ? 'Espera...' : 'Cerrar'}
          </Button>
          <Button
            onClick={handleBulkUpload}
            variant="contained"
            disabled={uploading || bulkFiles.length === 0}
            sx={{
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              '&:hover': { backgroundColor: '#F4D03Fdd' },
              '&:disabled': { backgroundColor: '#F4D03F33', color: '#00000099' },
            }}
          >
            {uploading ? 'Procesando...' : `Subir ${bulkFiles.length} Archivos`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
