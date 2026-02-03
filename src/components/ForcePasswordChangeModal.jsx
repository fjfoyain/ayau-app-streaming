import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  LinearProgress,
  Alert,
} from '@mui/material';
import { supabase } from '../lib/supabase';

/**
 * Componente: Modal obligatorio para cambiar contraseña en primer login
 * Se muestra bloqueante si el usuario no ha cambiado su contraseña
 */
export const ForcePasswordChangeModal = ({ session }) => {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [needsChange, setNeedsChange] = useState(false);

  // Verificar si usuario necesita cambiar contraseña
  useEffect(() => {
    const checkPasswordStatus = async () => {
      if (!session?.user?.id) return;

      try {
        const { data, error } = await supabase.rpc(
          'user_needs_password_change'
        );

        if (error) {
          console.error('Error checking password status:', error);
          return;
        }

        if (data) {
          setNeedsChange(true);
          setOpen(true);
        }
      } catch (err) {
        console.error('Error:', err);
      }
    };

    checkPasswordStatus();
  }, [session?.user?.id]);

  // Calcular fortaleza de contraseña
  const calculatePasswordStrength = (password) => {
    let strength = 0;

    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 10;

    return Math.min(strength, 100);
  };

  const handlePasswordChange = (value) => {
    setNewPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
    setError('');
  };

  const validatePasswords = () => {
    if (!newPassword || !confirmPassword) {
      setError('Por favor completa ambos campos');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener mínimo 8 caracteres');
      return false;
    }

    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword)) {
      setError('La contraseña debe contener mayúsculas y minúsculas');
      return false;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError('La contraseña debe contener números');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validatePasswords()) return;

    setLoading(true);
    setError('');

    try {
      // Actualizar contraseña en Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || 'Error al actualizar contraseña');
        setLoading(false);
        return;
      }

      // Marcar que la contraseña fue cambiada
      const { error: markError } = await supabase.rpc(
        'mark_password_changed'
      );

      if (markError) {
        console.error('Error marking password changed:', markError);
        // Continuar de todas formas
      }

      // Cerrar modal
      setOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      setNeedsChange(false);

      // Mostrar mensaje de éxito
      alert('Contraseña actualizada exitosamente');
    } catch (err) {
      setError(err.message || 'Error al actualizar contraseña');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength < 30) return '#f44336'; // Rojo
    if (passwordStrength < 60) return '#ff9800'; // Naranja
    if (passwordStrength < 80) return '#ffd600'; // Amarillo
    return '#4caf50'; // Verde
  };

  const getStrengthText = () => {
    if (passwordStrength < 30) return 'Muy débil';
    if (passwordStrength < 60) return 'Débil';
    if (passwordStrength < 80) return 'Media';
    return 'Fuerte';
  };

  if (!needsChange) return null;

  return (
    <Dialog
      open={open}
      onClose={() => false}
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          backgroundColor: '#1a1a1a',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: '#F4D03F',
          color: '#000',
          fontWeight: 'bold',
          borderBottom: '3px solid #F4D03F',
        }}
      >
        Cambio de Contraseña Obligatorio
      </DialogTitle>

      <DialogContent sx={{ backgroundColor: '#1a1a1a', pt: 3 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Esta es tu primera vez accediendo. <strong>Debes cambiar tu contraseña</strong> para continuar.
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Nueva Contraseña */}
          <TextField
            label="Nueva Contraseña"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="Mínimo 8 caracteres, mayúsculas, números"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                borderColor: '#F4D03F',
                '& fieldset': {
                  borderColor: '#F4D03F',
                },
              },
              '& .MuiInputBase-input::placeholder': {
                color: '#999',
                opacity: 0.7,
              },
            }}
            disabled={loading}
          />

          {/* Indicador de Fortaleza */}
          {newPassword && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ color: '#fff' }}>
                  Fortaleza de contraseña
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: getStrengthColor(), fontWeight: 'bold' }}
                >
                  {getStrengthText()} ({passwordStrength}%)
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={passwordStrength}
                sx={{
                  backgroundColor: '#333',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getStrengthColor(),
                  },
                }}
              />
              
              {/* Requisitos */}
              <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: newPassword.length >= 8 ? '#4caf50' : '#999',
                  }}
                >
                  ✓ Mínimo 8 caracteres
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color:
                      /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)
                        ? '#4caf50'
                        : '#999',
                  }}
                >
                  ✓ Mayúsculas y minúsculas
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: /[0-9]/.test(newPassword) ? '#4caf50' : '#999',
                  }}
                >
                  ✓ Números
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                      newPassword
                    )
                      ? '#4caf50'
                      : '#999',
                  }}
                >
                  ✓ Caracteres especiales (opcional)
                </Typography>
              </Box>
            </Box>
          )}

          {/* Confirmar Contraseña */}
          <TextField
            label="Confirmar Contraseña"
            type="password"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu contraseña"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                borderColor: '#F4D03F',
                '& fieldset': {
                  borderColor: '#F4D03F',
                },
              },
              '& .MuiInputBase-input::placeholder': {
                color: '#999',
                opacity: 0.7,
              },
            }}
            disabled={loading}
            error={confirmPassword && newPassword !== confirmPassword}
            helperText={
              confirmPassword && newPassword !== confirmPassword
                ? 'Las contraseñas no coinciden'
                : ''
            }
          />

          {/* Mensajes de Error */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Información */}
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="caption">
              <strong>Importante:</strong> No puedes continuar sin cambiar tu contraseña.
              Esto es obligatorio por seguridad.
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          backgroundColor: '#1a1a1a',
          borderTop: '1px solid #F4D03F',
          p: 2,
        }}
      >
        <Button
          onClick={handleSubmit}
          disabled={
            !newPassword ||
            !confirmPassword ||
            newPassword !== confirmPassword ||
            loading ||
            passwordStrength < 30
          }
          sx={{
            backgroundColor: '#F4D03F',
            color: '#000',
            fontWeight: 'bold',
            '&:hover': {
              backgroundColor: '#FFD700',
            },
            '&:disabled': {
              backgroundColor: '#666',
              color: '#999',
            },
          }}
          variant="contained"
          fullWidth
        >
          {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ForcePasswordChangeModal;
