import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useRemoteControl } from '../context/RemoteControlContext';

export default function RemoteControlBanner() {
  const {
    isFeatureEnabled,
    isActivePlayer,
    isRemote,
    activePlayerIsStale,
    isTransferring,
    connectionStatus,
    requestTransfer,
    claimActivePlayerRole,
  } = useRemoteControl();

  if (!isFeatureEnabled) return null;

  if (isActivePlayer) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
        <Chip
          icon={<VolumeUpIcon sx={{ fontSize: 14, color: '#4CAF50 !important' }} />}
          label="Reproductor Activo"
          size="small"
          sx={{
            backgroundColor: '#4CAF5018',
            color: '#4CAF50',
            border: '1px solid #4CAF5044',
            fontSize: '0.7rem',
            height: 22,
          }}
        />
      </Box>
    );
  }

  if (isRemote) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
        <Chip
          icon={
            connectionStatus === 'connected'
              ? <PhoneAndroidIcon sx={{ fontSize: 14, color: '#F4D03F !important' }} />
              : <WifiOffIcon sx={{ fontSize: 14, color: '#ff525288 !important' }} />
          }
          label="Control Remoto"
          size="small"
          sx={{
            backgroundColor: '#F4D03F18',
            color: connectionStatus === 'connected' ? '#F4D03F' : '#ff525288',
            border: `1px solid ${connectionStatus === 'connected' ? '#F4D03F44' : '#ff525244'}`,
            fontSize: '0.7rem',
            height: 22,
          }}
        />

        {isTransferring ? (
          <CircularProgress size={14} sx={{ color: '#F4D03F' }} />
        ) : activePlayerIsStale ? (
          <Button
            size="small"
            variant="outlined"
            onClick={claimActivePlayerRole}
            sx={{
              fontSize: '0.65rem',
              py: 0,
              px: 1,
              height: 22,
              minWidth: 'unset',
              color: '#F4D03F',
              borderColor: '#F4D03F44',
              '&:hover': { borderColor: '#F4D03F', backgroundColor: '#F4D03F18' },
            }}
          >
            Reclamar Reproductor
          </Button>
        ) : (
          <Button
            size="small"
            variant="outlined"
            onClick={requestTransfer}
            disabled={connectionStatus !== 'connected'}
            sx={{
              fontSize: '0.65rem',
              py: 0,
              px: 1,
              height: 22,
              minWidth: 'unset',
              color: '#F4D03F',
              borderColor: '#F4D03F44',
              '&:hover': { borderColor: '#F4D03F', backgroundColor: '#F4D03F18' },
              '&:disabled': { color: '#F4D03F44', borderColor: '#F4D03F22' },
            }}
          >
            Reproducir aquí
          </Button>
        )}
      </Box>
    );
  }

  return null;
}
