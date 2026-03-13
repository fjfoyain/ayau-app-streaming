import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  getCurrentUserProfile,
  getActivePlayerForUser,
  registerDeviceSession,
  claimActivePlayer,
  releaseDeviceSession,
  heartbeatActivePlayer,
  subscribeToRemoteControlChannel,
  sendToRemoteControlChannel,
} from '../services/supabase-api';
import { usePlayer } from './PlayerContext';

// ================================================
// DEVICE ID — persists per browser tab via sessionStorage
// ================================================
const getOrCreateDeviceId = () => {
  let id = sessionStorage.getItem('rc_device_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('rc_device_id', id);
  }
  return id;
};

// ================================================
// CONTEXT
// ================================================
const RemoteControlContext = createContext(null);

export const useRemoteControl = () => useContext(RemoteControlContext);

// ================================================
// PROVIDER
// ================================================
export const RemoteControlProvider = ({ children }) => {
  const { state: playerState, dispatch: playerDispatch } = usePlayer();

  const [isFeatureEnabled, setIsFeatureEnabled] = useState(false);
  const [role, setRole] = useState(null); // 'active_player' | 'remote' | null
  const [activePlayerIsStale, setActivePlayerIsStale] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [userId, setUserId] = useState(null);

  const deviceId = useRef(getOrCreateDeviceId());
  const channelRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const stalenessIntervalRef = useRef(null);
  const lastApHeartbeatRef = useRef(null);
  const originalPlayRef = useRef(null);
  const transferTimeoutRef = useRef(null);

  const isActivePlayer = role === 'active_player';
  const isRemote = role === 'remote';

  // ================================================
  // AUDIO GATE — patches audio.play() on remote devices
  // ================================================
  useEffect(() => {
    const audio = playerState.audio;
    if (!audio) return;

    if (!originalPlayRef.current) {
      originalPlayRef.current = audio.play.bind(audio);
    }

    if (isRemote) {
      audio.play = () => Promise.resolve();
    } else {
      if (originalPlayRef.current) {
        audio.play = originalPlayRef.current;
      }
    }

    return () => {
      // Restore on unmount
      if (originalPlayRef.current && audio) {
        audio.play = originalPlayRef.current;
      }
    };
  }, [isRemote, playerState.audio]);

  // ================================================
  // HEARTBEAT (only for active player)
  // ================================================
  const startHeartbeat = useCallback((uid, did, channel) => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(async () => {
      await heartbeatActivePlayer(uid, did);
      if (channel) {
        sendToRemoteControlChannel(channel, 'AP_HEARTBEAT', {
          deviceId: did,
          timestamp: Date.now(),
        });
      }
    }, 15000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // ================================================
  // STALENESS CHECK (only for remote devices)
  // ================================================
  const startStalenessCheck = useCallback(() => {
    if (stalenessIntervalRef.current) clearInterval(stalenessIntervalRef.current);
    lastApHeartbeatRef.current = Date.now(); // assume fresh on connect
    stalenessIntervalRef.current = setInterval(() => {
      if (lastApHeartbeatRef.current === null) return;
      const stale = Date.now() - lastApHeartbeatRef.current > 30000;
      setActivePlayerIsStale(stale);
    }, 10000);
  }, []);

  const stopStalenessCheck = useCallback(() => {
    if (stalenessIntervalRef.current) {
      clearInterval(stalenessIntervalRef.current);
      stalenessIntervalRef.current = null;
    }
  }, []);

  // ================================================
  // SUBSCRIBE TO REALTIME CHANNEL
  // ================================================
  const subscribeChannel = useCallback((uid, did, currentRole) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionStatus('connecting');

    const channel = subscribeToRemoteControlChannel(uid, {
      // ---- Active Player receives commands from remotes ----
      REMOTE_PLAY_PAUSE: () => {
        if (did !== deviceId.current) return; // only AP processes commands
        playerDispatch({ type: 'TOGGLE_PLAY_PAUSE' });
        // AP_STATE_SYNC will be sent by the effect watching playerState
      },
      REMOTE_NEXT: () => {
        if (did !== deviceId.current) return;
        const playlist = playerState.currentPlaylist;
        if (!playlist?.playlist?.length) return;
        const nextIndex = ((playlist.songIndex ?? 0) + 1) % playlist.playlist.length;
        playerDispatch({ type: 'NEXT_SONG', payload: playlist.playlist[nextIndex] });
      },
      REMOTE_PREV: () => {
        if (did !== deviceId.current) return;
        const playlist = playerState.currentPlaylist;
        if (!playlist?.playlist?.length) return;
        const prevIndex = ((playlist.songIndex ?? 0) - 1 + playlist.playlist.length) % playlist.playlist.length;
        playerDispatch({ type: 'PREV_SONG', payload: playlist.playlist[prevIndex] });
      },
      REMOTE_SEEK: ({ position }) => {
        if (did !== deviceId.current) return;
        playerDispatch({ type: 'SYNC_SEEK', payload: position });
      },
      REMOTE_SET_SONG: ({ song, playlistInfo }) => {
        if (did !== deviceId.current) return;
        playerDispatch({ type: 'PLAY_SONG', payload: song, playlistInfo });
      },
      REQUEST_TRANSFER: ({ requestingDeviceId }) => {
        // Only AP handles this — yield to the requesting device
        if (did !== deviceId.current) return;
        const currentSong = playerState.currentSong;
        const position = playerState.audio?.currentTime ?? 0;

        // Become remote
        registerDeviceSession(uid, did, 'remote')
          .then(() => {
            setRole('remote');
            stopHeartbeat();
            startStalenessCheck();
            sendToRemoteControlChannel(channel, 'AP_YIELDING', {
              yieldingTo: requestingDeviceId,
              song: currentSong,
              position,
            });
          })
          .catch(console.error);
      },

      // ---- Remote devices receive state from AP ----
      AP_HEARTBEAT: ({ timestamp }) => {
        lastApHeartbeatRef.current = timestamp ?? Date.now();
        setActivePlayerIsStale(false);
      },
      AP_STATE_SYNC: ({ song, isPlaying, position }) => {
        // Only non-AP devices apply this
        if (did === deviceId.current && currentRole === 'active_player') return;
        if (song) {
          playerDispatch({
            type: 'REMOTE_APPLY_STATE',
            payload: { song, isPlaying, position },
          });
        }
      },
      AP_YIELDING: ({ yieldingTo, song, position }) => {
        // Only the requesting device claims the active_player role
        if (yieldingTo !== deviceId.current) return;
        if (transferTimeoutRef.current) {
          clearTimeout(transferTimeoutRef.current);
          transferTimeoutRef.current = null;
        }
        claimActivePlayer(uid, did)
          .then((success) => {
            if (success) {
              setRole('active_player');
              stopStalenessCheck();
              setActivePlayerIsStale(false);
              startHeartbeat(uid, did, channel);
              if (song) {
                playerDispatch({ type: 'PLAY_SONG', payload: { ...song, _resumePosition: position }, playlistInfo: playerState.currentPlaylist });
              }
            }
            setIsTransferring(false);
          })
          .catch(() => setIsTransferring(false));
      },
    });

    channelRef.current = channel;

    // Track subscription status
    const originalSubscribe = channel.subscribe;
    channel.subscribe = (callback) => {
      return originalSubscribe.call(channel, (status) => {
        if (status === 'SUBSCRIBED') setConnectionStatus('connected');
        else if (status === 'CHANNEL_ERROR') setConnectionStatus('error');
        else if (status === 'TIMED_OUT') setConnectionStatus('error');
        if (callback) callback(status);
      });
    };

    // Trigger status update after a short delay (channel is already subscribed by subscribeToRemoteControlChannel)
    setTimeout(() => setConnectionStatus('connected'), 500);

    return channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerDispatch, startHeartbeat, stopHeartbeat, startStalenessCheck, stopStalenessCheck]);

  // ================================================
  // INITIALIZATION
  // ================================================
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const profile = await getCurrentUserProfile();
      if (!mounted || !profile) return;

      if (!profile.remote_control_enabled) {
        setIsFeatureEnabled(false);
        return;
      }

      setIsFeatureEnabled(true);
      const uid = profile.id;
      setUserId(uid);
      const did = deviceId.current;

      // Check if an active player already exists for this user
      const existingAP = await getActivePlayerForUser(uid);
      if (!mounted) return;

      let assignedRole;

      if (!existingAP) {
        // No active player → this device claims the role
        const success = await claimActivePlayer(uid, did);
        assignedRole = success ? 'active_player' : 'remote';
      } else if (existingAP.device_id === did) {
        // This device IS the existing active player (e.g. page refresh)
        assignedRole = 'active_player';
      } else {
        // Another device is the active player → this is remote
        await registerDeviceSession(uid, did, 'remote');
        assignedRole = 'remote';
      }

      if (!mounted) return;
      setRole(assignedRole);

      const channel = subscribeChannel(uid, did, assignedRole);

      if (assignedRole === 'active_player') {
        startHeartbeat(uid, did, channel);
      } else {
        startStalenessCheck();
      }

      // Clean up on tab close
      const handleUnload = () => {
        releaseDeviceSession(uid, did);
      };
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        window.removeEventListener('beforeunload', handleUnload);
      };
    };

    const cleanupFn = { current: null };
    initialize().then(fn => { cleanupFn.current = fn; });

    // Auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (userId) releaseDeviceSession(userId, deviceId.current);
        setRole(null);
        setIsFeatureEnabled(false);
        stopHeartbeat();
        stopStalenessCheck();
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    return () => {
      mounted = false;
      if (cleanupFn.current) cleanupFn.current();
      authListener?.subscription.unsubscribe();
      stopHeartbeat();
      stopStalenessCheck();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (transferTimeoutRef.current) {
        clearTimeout(transferTimeoutRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================================================
  // BROADCAST STATE SYNC from Active Player
  // Whenever playerState changes on the AP, broadcast to remotes
  // ================================================
  useEffect(() => {
    if (!isActivePlayer || !channelRef.current || !userId) return;
    if (playerState._syncApplied) return; // avoid loops from incoming sync

    const channel = channelRef.current;
    sendToRemoteControlChannel(channel, 'AP_STATE_SYNC', {
      song: playerState.currentSong,
      isPlaying: playerState.isPlaying,
      position: playerState.audio?.currentTime ?? 0,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.currentSong?.id, playerState.isPlaying, isActivePlayer, userId]);

  // ================================================
  // RESUME POSITION after transfer (active player received song with _resumePosition)
  // ================================================
  useEffect(() => {
    if (!isActivePlayer) return;
    const pos = playerState.currentSong?._resumePosition;
    if (pos != null && pos > 0 && playerState.audio) {
      const audio = playerState.audio;
      const trySeek = () => {
        if (audio.readyState >= 2) {
          audio.currentTime = pos;
        } else {
          audio.addEventListener('canplay', () => { audio.currentTime = pos; }, { once: true });
        }
      };
      trySeek();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerState.currentSong?.id, isActivePlayer]);

  // ================================================
  // PUBLIC ACTIONS
  // ================================================

  /**
   * Remote → sends a command to the Active Player via Broadcast
   */
  const sendRemoteCommand = useCallback((event, payload = {}) => {
    if (!channelRef.current) return;
    sendToRemoteControlChannel(channelRef.current, event, payload);
  }, []);

  /**
   * Remote requests to become the Active Player (voluntary transfer)
   * AP will receive REQUEST_TRANSFER and yield; fallback claim after 2s
   */
  const requestTransfer = useCallback(() => {
    if (!isRemote || !channelRef.current || !userId) return;
    setIsTransferring(true);
    sendToRemoteControlChannel(channelRef.current, 'REQUEST_TRANSFER', {
      requestingDeviceId: deviceId.current,
    });

    // Fallback: if AP doesn't respond in 2 seconds, claim directly
    transferTimeoutRef.current = setTimeout(async () => {
      const success = await claimActivePlayer(userId, deviceId.current);
      if (success) {
        setRole('active_player');
        stopStalenessCheck();
        setActivePlayerIsStale(false);
        startHeartbeat(userId, deviceId.current, channelRef.current);
      }
      setIsTransferring(false);
    }, 2000);
  }, [isRemote, userId, startHeartbeat, stopStalenessCheck]);

  /**
   * Remote claims Active Player when AP is stale/disconnected
   */
  const claimActivePlayerRole = useCallback(async () => {
    if (!userId) return;
    const success = await claimActivePlayer(userId, deviceId.current);
    if (success) {
      setRole('active_player');
      stopStalenessCheck();
      setActivePlayerIsStale(false);
      startHeartbeat(userId, deviceId.current, channelRef.current);
    }
  }, [userId, startHeartbeat, stopStalenessCheck]);

  /**
   * Active Player voluntarily becomes Remote
   */
  const releaseActivePlayerRole = useCallback(async () => {
    if (!isActivePlayer || !userId) return;
    await registerDeviceSession(userId, deviceId.current, 'remote');
    setRole('remote');
    stopHeartbeat();
    startStalenessCheck();
  }, [isActivePlayer, userId, stopHeartbeat, startStalenessCheck]);

  // ================================================
  // CONTEXT VALUE
  // ================================================
  const value = {
    isFeatureEnabled,
    deviceId: deviceId.current,
    role,
    isActivePlayer,
    isRemote,
    activePlayerIsStale,
    isTransferring,
    connectionStatus,
    sendRemoteCommand,
    requestTransfer,
    claimActivePlayerRole,
    releaseActivePlayerRole,
  };

  return (
    <RemoteControlContext.Provider value={value}>
      {children}
    </RemoteControlContext.Provider>
  );
};
