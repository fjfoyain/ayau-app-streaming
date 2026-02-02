import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import SyncIcon from '@mui/icons-material/Sync';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PersonIcon from '@mui/icons-material/Person';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useSyncPlayback } from '../context/SyncPlaybackContext';

export default function DJModePanel() {
  const [expanded, setExpanded] = useState(true);
  const {
    playbackMode,
    isController,
    controllerName,
    canControl,
    connectionStatus,
    takeControl,
    releaseControl,
    isSyncEnabled,
    userProfile,
  } = useSyncPlayback();

  // Only show for synchronized mode
  if (playbackMode !== 'synchronized') {
    return null;
  }

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <WifiIcon sx={{ color: '#4CAF50', fontSize: 16 }} />;
      case 'connecting':
        return <WifiIcon sx={{ color: '#F4D03F', fontSize: 16, animation: 'pulse 1s infinite' }} />;
      default:
        return <WifiOffIcon sx={{ color: '#ff5252', fontSize: 16 }} />;
    }
  };

  const getConnectionLabel = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Conectado';
      case 'connecting':
        return 'Conectando...';
      case 'error':
        return 'Error';
      default:
        return 'Desconectado';
    }
  };

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        top: 80,
        right: 16,
        zIndex: 1000,
        backgroundColor: '#000',
        border: '2px solid #F4D03F',
        borderRadius: '12px',
        minWidth: 280,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: expanded ? '1px solid #F4D03F44' : 'none',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon sx={{ color: '#F4D03F' }} />
          <Typography variant="subtitle1" sx={{ color: '#F4D03F', fontWeight: 'bold' }}>
            Modo DJ
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getConnectionIcon()}
          <IconButton size="small" sx={{ color: '#F4D03F' }}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* Connection Status */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip
              icon={getConnectionIcon()}
              label={getConnectionLabel()}
              size="small"
              sx={{
                backgroundColor: connectionStatus === 'connected' ? '#4CAF5022' : '#F4D03F22',
                color: connectionStatus === 'connected' ? '#4CAF50' : '#F4D03F',
                border: `1px solid ${connectionStatus === 'connected' ? '#4CAF5044' : '#F4D03F44'}`,
              }}
            />
          </Box>

          {/* Controller Info */}
          <Box
            sx={{
              p: 2,
              backgroundColor: '#F4D03F11',
              borderRadius: '8px',
              mb: 2,
            }}
          >
            {isController ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PlayArrowIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: '#4CAF50', fontWeight: 'bold' }}>
                    Tú controlas la música
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#F4D03F66' }}>
                  Todos los locales reproducen lo que selecciones
                </Typography>
              </>
            ) : controllerName ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PersonIcon sx={{ color: '#F4D03F', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: '#F4D03F' }}>
                    Controlado por: <strong>{controllerName}</strong>
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#F4D03F66' }}>
                  La reproducción está siendo controlada remotamente
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body2" sx={{ color: '#F4D03F99', mb: 1 }}>
                  Nadie está controlando
                </Typography>
                <Typography variant="caption" sx={{ color: '#F4D03F66' }}>
                  Toma el control para sincronizar todos los locales
                </Typography>
              </>
            )}
          </Box>

          {/* Control Button */}
          {canControl && (
            <Button
              fullWidth
              variant={isController ? 'outlined' : 'contained'}
              onClick={isController ? releaseControl : takeControl}
              disabled={connectionStatus !== 'connected'}
              sx={{
                backgroundColor: isController ? 'transparent' : '#F4D03F',
                color: isController ? '#F4D03F' : '#000',
                borderColor: '#F4D03F',
                fontWeight: 'bold',
                '&:hover': {
                  backgroundColor: isController ? '#F4D03F22' : '#F4D03Fdd',
                  borderColor: '#F4D03F',
                },
                '&:disabled': {
                  backgroundColor: '#F4D03F33',
                  color: '#00000066',
                },
              }}
            >
              {isController ? 'Soltar Control' : 'Tomar Control'}
            </Button>
          )}

          {!canControl && (
            <Typography variant="caption" sx={{ color: '#F4D03F66', display: 'block', textAlign: 'center' }}>
              Solo administradores de cuenta pueden controlar
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
