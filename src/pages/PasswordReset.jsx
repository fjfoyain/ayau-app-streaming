import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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

export default function PasswordReset() {
  const navigate = useNavigate();

  // Read URL params via lazy initializer — runs synchronously during first render,
  // BEFORE Supabase's async initialize() can clear the hash. Most reliable detection
  // for invite/recovery links regardless of flow type (implicit or PKCE).
  const [step, setStep] = useState(() => {
    const h = new URLSearchParams(window.location.hash.replace('#', ''));
    const s = new URLSearchParams(window.location.search);
    const type = h.get('type');                   // implicit: 'recovery' | 'invite'
    const code = s.get('code');                   // PKCE flow
    const errorCode = h.get('error_code') || s.get('error_code');
    if (errorCode === 'otp_expired') return 0;
    if (type === 'recovery' || type === 'invite' || code) return 1;
    return 0;
  });

  const [isNewUser, setIsNewUser] = useState(() =>
    new URLSearchParams(window.location.hash.replace('#', '')).get('type') === 'invite'
  );
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const searchParams = new URLSearchParams(window.location.search);
    const hashError = hashParams.get('error_code') || searchParams.get('error_code');
    const urlError = hashParams.get('error') || searchParams.get('error');

    // Handle expired or invalid link
    if (hashError === 'otp_expired' || urlError === 'access_denied') {
      setError('El enlace ha expirado o ya fue utilizado. Solicita al administrador que reenvíe la invitación, o usa "Olvidé mi contraseña" desde el login.');
      return;
    }

    // Async fallback: getSession() resolves once Supabase finishes token exchange
    // (covers PKCE code exchange and sessions already in storage).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsNewUser(!session.user?.email_confirmed_at);
        setStep(1);
      }
    });

    // onAuthStateChange covers late-firing events (e.g. PKCE exchange completing after mount)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN' ||
        (event === 'INITIAL_SESSION' && session)
      ) {
        setIsNewUser(!session?.user?.email_confirmed_at);
        setStep(1);
        setError('');
        setSuccess('');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) strength++;
    setPasswordStrength(strength);
  };

  // Step 0: request the reset email via Supabase native flow
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/password-reset`,
      });
      if (error) throw error;
      // Generic message to avoid user enumeration
      setSuccess('Si el correo existe en el sistema, recibirás un enlace para restablecer la contraseña. Revisa también la carpeta de spam.');
      setEmail('');
    } catch {
      setSuccess('Si el correo existe en el sistema, recibirás un enlace para restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: set the new password (Supabase recovery session is already active)
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setSuccess('Tu contraseña ha sido restablecida exitosamente. Redirigiendo...');
      // Sign out so the user logs in fresh with the new password
      await supabase.auth.signOut();
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.message || 'Error al restablecer la contraseña. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" sx={{ mb: 3, textAlign: 'center', fontWeight: 'bold' }}>
            {isNewUser ? 'Establecer Contraseña' : 'Recuperar Contraseña'}
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

          {/* Step 0: Email */}
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
                  href="/"
                  sx={{ cursor: 'pointer', textDecoration: 'none', color: '#F4D03F' }}
                >
                  Volver a Login
                </Link>
              </Box>
            </Box>
          )}

          {/* Step 1: New Password */}
          {step === 1 && (
            <Box component="form" onSubmit={handleResetPassword} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                {isNewUser
                  ? 'Bienvenido a Ayau. Crea una contraseña para acceder a tu cuenta.'
                  : 'Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.'}
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
                          backgroundColor: i < passwordStrength ? '#4CAF50' : '#e0e0e0',
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
                  href="/"
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
