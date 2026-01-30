import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import MusicNoteIcon from '@mui/icons-material/MusicNote';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        padding: 3,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          maxWidth: 450,
          width: '100%',
          p: 5,
          backgroundColor: '#000',
          border: '3px solid #F4D03F',
          borderRadius: '20px',
        }}
      >
        {/* Logo and Title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <MusicNoteIcon sx={{ fontSize: 60, color: '#F4D03F', mb: 2 }} />
          <Typography
            variant="h3"
            sx={{
              color: '#F4D03F',
              fontWeight: 'bold',
              mb: 1,
              letterSpacing: 2,
            }}
          >
            AYAU
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              color: '#F4D03F99',
              fontStyle: 'italic',
              fontSize: '1.1rem',
            }}
          >
            MÚSICA, ON FIRE
          </Typography>
        </Box>

        {/* Subtitle */}
        <Typography
          variant="body1"
          sx={{
            color: '#F4D03F99',
            textAlign: 'center',
            mb: 4,
          }}
        >
          Inicia sesión para acceder a la plataforma
        </Typography>

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              backgroundColor: '#F4433611',
              color: '#F44336',
              border: '1px solid #F44336',
              '& .MuiAlert-icon': {
                color: '#F44336',
              },
            }}
          >
            {error}
          </Alert>
        )}

        {/* Login Form */}
        <Box component="form" onSubmit={handleLogin} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Correo electrónico"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                color: '#F4D03F',
                '& fieldset': {
                  borderColor: '#F4D03F44',
                  borderWidth: 2,
                },
                '&:hover fieldset': {
                  borderColor: '#F4D03F',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#F4D03F',
                },
              },
              '& .MuiInputLabel-root': {
                color: '#F4D03F99',
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#F4D03F',
              },
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Contraseña"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                color: '#F4D03F',
                '& fieldset': {
                  borderColor: '#F4D03F44',
                  borderWidth: 2,
                },
                '&:hover fieldset': {
                  borderColor: '#F4D03F',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#F4D03F',
                },
              },
              '& .MuiInputLabel-root': {
                color: '#F4D03F99',
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#F4D03F',
              },
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              mt: 2,
              py: 1.5,
              backgroundColor: '#F4D03F',
              color: '#000',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              borderRadius: '12px',
              '&:hover': {
                backgroundColor: '#F4D03Fdd',
              },
              '&:disabled': {
                backgroundColor: '#F4D03F33',
                color: '#00000099',
              },
            }}
          >
            {loading ? 'Iniciando sesión...' : 'INICIAR SESIÓN'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
