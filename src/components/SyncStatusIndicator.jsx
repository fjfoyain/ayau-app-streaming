import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import SyncIcon from '@mui/icons-material/Sync';
import PersonIcon from '@mui/icons-material/Person';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useSyncPlayback } from '../context/SyncPlaybackContext';

export default function SyncStatusIndicator({ compact = false }) {
  const {
    playbackMode,
    isController,
    controllerName,
    connectionStatus,
    isSyncEnabled,
  } = useSyncPlayback();

  // Only show for synchronized mode
  if (playbackMode !== 'synchronized') {
    return null;
  }

  const isConnected = connectionStatus === 'connected';

  if (compact) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <SyncIcon sx={{ color: '#F4D03F', fontSize: 16 }} />
        {isConnected ? (
          <WifiIcon sx={{ color: '#4CAF50', fontSize: 14 }} />
        ) : (
          <WifiOffIcon sx={{ color: '#ff5252', fontSize: 14 }} />
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        backgroundColor: '#F4D03F11',
        borderRadius: '20px',
        border: '1px solid #F4D03F44',
      }}
    >
      <SyncIcon sx={{ color: '#F4D03F', fontSize: 18 }} />

      {isController ? (
        <Typography variant="caption" sx={{ color: '#4CAF50', fontWeight: 'bold' }}>
          DJ Mode: Controlando
        </Typography>
      ) : controllerName ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonIcon sx={{ color: '#F4D03F99', fontSize: 14 }} />
          <Typography variant="caption" sx={{ color: '#F4D03F99' }}>
            {controllerName}
          </Typography>
        </Box>
      ) : (
        <Typography variant="caption" sx={{ color: '#F4D03F66' }}>
          Sincronizado
        </Typography>
      )}

      {isConnected ? (
        <WifiIcon sx={{ color: '#4CAF50', fontSize: 14 }} />
      ) : (
        <WifiOffIcon sx={{ color: '#ff5252', fontSize: 14 }} />
      )}
    </Box>
  );
}
