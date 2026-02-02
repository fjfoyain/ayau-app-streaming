import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  getCurrentUserProfile,
  getCurrentUserClientId,
  getClientPlaybackMode,
  ensurePlaybackSession,
  getPlaybackSessionByClient,
  broadcastPlaybackState,
  takePlaybackControl,
  releasePlaybackControl,
  subscribeToPlaybackSessionEnhanced,
  canControlPlayback,
} from '../services/supabase-api';
import { usePlayer } from './PlayerContext';

// ================================================
// STATE & REDUCER
// ================================================

const initialState = {
  // User context
  userProfile: null,
  clientId: null,
  isAccountLevelUser: false,
  canControl: false,

  // Playback mode
  playbackMode: 'independent', // 'independent' | 'shared_playlist' | 'synchronized'

  // Sync state (for synchronized mode)
  isController: false,
  controllerName: null,
  syncSession: null,
  lastSequenceNumber: 0,

  // Connection state
  connectionStatus: 'disconnected', // 'connecting' | 'connected' | 'disconnected' | 'error'

  // Loading states
  loading: true,
  error: null,
};

function syncReducer(state, action) {
  switch (action.type) {
    case 'SET_USER_CONTEXT':
      return {
        ...state,
        userProfile: action.payload.profile,
        clientId: action.payload.clientId,
        isAccountLevelUser: action.payload.isAccountLevel,
        canControl: action.payload.canControl,
        loading: false,
      };

    case 'SET_PLAYBACK_MODE':
      return {
        ...state,
        playbackMode: action.payload,
      };

    case 'SET_SYNC_SESSION':
      return {
        ...state,
        syncSession: action.payload,
        isController: action.payload?.controlled_by === state.userProfile?.id,
        controllerName: action.payload?.controller?.full_name || null,
        lastSequenceNumber: action.payload?.sequence_number || 0,
      };

    case 'SET_CONTROLLER':
      return {
        ...state,
        isController: action.payload.isController,
        controllerName: action.payload.controllerName,
      };

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connectionStatus: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ================================================
// CONTEXT
// ================================================

const SyncPlaybackContext = createContext(null);

export function SyncPlaybackProvider({ children }) {
  const [state, dispatch] = useReducer(syncReducer, initialState);
  const { state: playerState, dispatch: playerDispatch } = usePlayer();
  const channelRef = useRef(null);
  const isBroadcastingRef = useRef(false);

  // ================================================
  // Initialize user context
  // ================================================
  useEffect(() => {
    const initializeContext = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!profile) {
          dispatch({ type: 'SET_ERROR', payload: 'No user profile found' });
          return;
        }

        const clientId = await getCurrentUserClientId();
        const isAccountLevel = profile.access_level === 'account';
        const canCtrl = clientId ? await canControlPlayback(clientId) : false;

        dispatch({
          type: 'SET_USER_CONTEXT',
          payload: {
            profile,
            clientId,
            isAccountLevel,
            canControl: canCtrl,
          },
        });

        // Get playback mode if we have a client
        if (clientId) {
          const mode = await getClientPlaybackMode(clientId);
          dispatch({ type: 'SET_PLAYBACK_MODE', payload: mode });

          // Ensure session exists and get current state
          if (mode === 'synchronized') {
            await ensurePlaybackSession(clientId);
            const session = await getPlaybackSessionByClient(clientId);
            dispatch({ type: 'SET_SYNC_SESSION', payload: session });
          }
        }
      } catch (error) {
        console.error('Error initializing sync context:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    };

    initializeContext();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'RESET' });
      } else if (event === 'SIGNED_IN') {
        initializeContext();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // ================================================
  // Subscribe to playback session changes
  // ================================================
  useEffect(() => {
    if (!state.clientId || state.playbackMode !== 'synchronized') {
      // Cleanup subscription if exists
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
      return;
    }

    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });

    const channel = subscribeToPlaybackSessionEnhanced(
      state.clientId,
      (newSession, oldSession, eventType) => {
        // Ignore if we're the one broadcasting
        if (isBroadcastingRef.current) {
          return;
        }

        // Ignore if this is an older update
        if (newSession.sequence_number <= state.lastSequenceNumber) {
          return;
        }

        // Update sync session state
        dispatch({ type: 'SET_SYNC_SESSION', payload: newSession });

        // Apply remote playback state if we're not the controller
        if (newSession.controlled_by !== state.userProfile?.id) {
          applyRemoteState(newSession);
        }
      }
    );

    channel.on('subscribe', (status) => {
      if (status === 'SUBSCRIBED') {
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
      } else if (status === 'CHANNEL_ERROR') {
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'error' });
      }
    });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [state.clientId, state.playbackMode, state.userProfile?.id]);

  // ================================================
  // Apply remote playback state to local player
  // ================================================
  const applyRemoteState = useCallback((session) => {
    if (!session) return;

    // Apply song change
    if (session.current_song_id && session.songs) {
      const remoteSong = {
        id: session.songs.id,
        title: session.songs.title,
        performer: session.songs.performer,
        url: session.songs.file_url,
        duration: session.songs.duration,
        coverImage: session.songs.cover_image_url,
        playlistId: session.current_playlist_id,
      };

      // Only change song if different
      if (playerState.currentSong?.id !== remoteSong.id) {
        playerDispatch({
          type: 'SYNC_APPLY_SONG',
          payload: remoteSong,
        });
      }
    }

    // Apply play/pause state
    if (session.playback_state === 'playing' && !playerState.isPlaying) {
      playerDispatch({ type: 'PLAY_SONG' });
    } else if (session.playback_state === 'paused' && playerState.isPlaying) {
      playerDispatch({ type: 'PAUSE_SONG' });
    }

    // TODO: Apply seek position if significantly different
  }, [playerState.currentSong?.id, playerState.isPlaying, playerDispatch]);

  // ================================================
  // Broadcast local changes (when controller)
  // ================================================
  const broadcast = useCallback(async (updates) => {
    if (!state.clientId || !state.isController || state.playbackMode !== 'synchronized') {
      return;
    }

    try {
      isBroadcastingRef.current = true;
      await broadcastPlaybackState(state.clientId, updates);
    } catch (error) {
      console.error('Error broadcasting:', error);
    } finally {
      // Reset flag after a short delay to allow the update to propagate
      setTimeout(() => {
        isBroadcastingRef.current = false;
      }, 500);
    }
  }, [state.clientId, state.isController, state.playbackMode]);

  // ================================================
  // Actions
  // ================================================
  const takeControl = useCallback(async () => {
    if (!state.clientId || !state.canControl) return;

    try {
      await takePlaybackControl(state.clientId);
      dispatch({
        type: 'SET_CONTROLLER',
        payload: {
          isController: true,
          controllerName: state.userProfile?.full_name,
        },
      });
    } catch (error) {
      console.error('Error taking control:', error);
    }
  }, [state.clientId, state.canControl, state.userProfile?.full_name]);

  const releaseControl = useCallback(async () => {
    if (!state.clientId) return;

    try {
      await releasePlaybackControl(state.clientId);
      dispatch({
        type: 'SET_CONTROLLER',
        payload: {
          isController: false,
          controllerName: null,
        },
      });
    } catch (error) {
      console.error('Error releasing control:', error);
    }
  }, [state.clientId]);

  const updatePlaybackMode = useCallback(async (mode) => {
    dispatch({ type: 'SET_PLAYBACK_MODE', payload: mode });
  }, []);

  const refreshSession = useCallback(async () => {
    if (!state.clientId) return;

    try {
      const session = await getPlaybackSessionByClient(state.clientId);
      dispatch({ type: 'SET_SYNC_SESSION', payload: session });
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  }, [state.clientId]);

  // ================================================
  // Context value
  // ================================================
  const value = {
    ...state,
    broadcast,
    takeControl,
    releaseControl,
    updatePlaybackMode,
    refreshSession,
    isSyncEnabled: state.playbackMode === 'synchronized',
  };

  return (
    <SyncPlaybackContext.Provider value={value}>
      {children}
    </SyncPlaybackContext.Provider>
  );
}

// ================================================
// Hook
// ================================================
export function useSyncPlayback() {
  const context = useContext(SyncPlaybackContext);
  if (!context) {
    throw new Error('useSyncPlayback must be used within a SyncPlaybackProvider');
  }
  return context;
}

export default SyncPlaybackContext;
