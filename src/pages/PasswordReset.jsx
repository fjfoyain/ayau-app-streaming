import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import { requestPasswordReset, completePasswordReset, validateResetToken } from '../services/supabase-api';

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [step, setStep] = useState(token ? 1 : 0); // 0: Email, 1: Reset Password
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(token ? true : false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Validar token si existe en URL
  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      setValidatingToken(true);
      const result = await validateResetToken(token);
      if (!result) {
        setError('Token inválido o expirado. Por favor, solicita un nuevo enlace de recuperación.');
        setStep(0);
      } else {
        setStep(1);
      }
    } catch (err) {
      console.error('Error validating token:', err);
      setError('Error validando token. Por favor, intenta nuevamente.');
      setStep(0);
    } finally {
      setValidatingToken(false);
    }
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;
    setPasswordStrength(strength);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await requestPasswordReset(email);
      if (result.success) {
        setSuccess('Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu correo (incluyendo spam).');
        setTimeout(() => {
          navigate('/login');
        }, 5000);
      } else {
        setSuccess('Si el correo existe en el sistema, recibirás un enlace para restablecer la contraseña.');
      }
      setEmail('');
    } catch (err) {
      console.error('Error requesting password reset:', err);
      setSuccess('Si el correo existe en el sistema, recibirás un enlace para restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      setError('Por favor, ingresa la nueva contraseña en ambos campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await completePasswordReset(token, newPassword);
      if (result.success) {
        setSuccess('Tu contraseña ha sido restablecida exitosamente. Redirigiendo a login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(result.message || 'Error al restablecer la contraseña');
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      setError('Error al restablecer la contraseña. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Validando enlace de recuperación...</Typography>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold' }}>
            Recuperar Contraseña
          </Typography>

          <Stepper activeStep={step} sx={{ mb: 4 }}>
            <Step completed={step > 0}>
              <StepLabel>Ingresar Email</StepLabel>
            </Step>
            <Step completed={step > 1}>
              <StepLabel>Nueva Contraseña</StepLabel>
            </Step>
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {/* Step 1: Email */}
          {step === 0 && (
            <Box component="form" onSubmit={handleEmailSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </Typography>

              <TextField
                label="Correo Electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                disabled={loading}
                placeholder="tu@correo.com"
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading || !email}
                sx={{ py: 1.5 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Enviar Enlace de Recuperación'}
              </Button>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link
                  href="/login"
                  sx={{ cursor: 'pointer', textDecoration: 'none', color: '#F4D03F' }}
                >
                  Volver a Login
                </Link>
              </Box>
            </Box>
          )}

          {/* Step 1: Reset Password */}
          {step === 1 && (
            <Box component="form" onSubmit={handleResetPassword} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
              </Typography>

              <TextField
                label="Nueva Contraseña"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  calculatePasswordStrength(e.target.value);
                }}
                fullWidth
                disabled={loading}
              />

              {/* Password Strength Indicator */}
              {newPassword && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ minWidth: 100 }}>
                    Fortaleza: 
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                    {[...Array(6)].map((_, i) => (
                      <Box
                        key={i}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 1,
                          backgroundColor: i < passwordStrength ? '#4CAF50' : '#e0e0e0'
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              <TextField
                label="Confirmar Contraseña"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                disabled={loading}
              />

              <Typography variant="caption" color="textSecondary">
                La contraseña debe incluir: mayúsculas, minúsculas, números y caracteres especiales (!@#$%^&*)
              </Typography>

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={loading || !newPassword || !confirmPassword}
                sx={{ py: 1.5 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Restablecer Contraseña'}
              </Button>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link
                  href="/login"
                  sx={{ cursor: 'pointer', textDecoration: 'none', color: '#F4D03F' }}
                >
                  Volver a Login
                </Link>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
