import { createContext, useReducer, useContext, useEffect, useRef } from "react";
import { getSignedUrl } from '../services/supabase-api';

const initialState = {
  currentSong: null,
  isPlaying: false,
  currentPlaylist: null, // { playlist: [...songs], songIndex: 0 }
  audio: (() => {
    const audio = new Audio();
    audio.volume = 0.5;
    audio.preload = 'metadata';
    return audio;
  })(),
};

const playerReducer = (state, action) => {
  switch (action.type) {
    case "SET_CURRENT_SONG":
      return { ...state, currentSong: action.payload, isPlaying: !!action.play }

    case "SET_PLAYING":
      return { ...state, isPlaying: action.payload }

    case "PLAY_SONG":
      // reducer keeps state minimal; actual audio control handled in PlayerProvider effects
      return { ...state, currentSong: action.payload, isPlaying: true, currentPlaylist: action.playlistInfo || state.currentPlaylist };

    case "PAUSE_SONG":
      state.audio.pause();
      return { ...state, isPlaying: false };

    case "TOGGLE_PLAY_PAUSE":
      if (!state.audio.src) {
        console.error("Audio source is not set. Cannot toggle playback.");
        return state;
      }

      if (state.isPlaying) {
        state.audio.pause();
      } else {
        state.audio.play().catch((error) => {
          console.error("Error resuming audio:", error);
        });
      }
      return { ...state, isPlaying: !state.isPlaying };

    case "STOP_SONG":
      state.audio.pause();
      state.audio.currentTime = 0;
      return { ...state, currentSong: null, isPlaying: false };

    case "NEXT_SONG":
    case "PREV_SONG":
      // Navigation actions will update currentSong; actual playback handled by effect
      return { ...state, currentSong: action.payload, isPlaying: true, currentPlaylist: (state.currentPlaylist ? { ...state.currentPlaylist, songIndex: state.currentPlaylist.playlist.findIndex(s => s.id === action.payload.id) } : null) };

    default:
      return state;
  }
};

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(playerReducer, initialState);
  const signedUrlCache = useRef(new Map());
  const saveTimer = useRef(null);
  const sessionSongIdRef = useRef(null); // Track current session song

  // When currentSong changes, resolve URL (signed if needed), set audio.src and play
  useEffect(() => {
    let mounted = true;
    const audio = state.audio;
    if (!state.currentSong) return;

    const setupAndPlay = async () => {
      try {
        let url = state.currentSong.url || '';
        // If URL is not an http(s) URL, create signed URL (and check cache)
        if (url && !/^https?:\/\//i.test(url)) {
          if (signedUrlCache.current.has(url)) {
            url = signedUrlCache.current.get(url);
          } else {
            const signed = await getSignedUrl(url, 3600);
            signedUrlCache.current.set(url, signed);
            url = signed;
          }
        }

        // Pause, set source and play
        audio.pause();
        audio.src = url;
        audio.load();

        // Apply resume position ONLY if same song in session (not after switching)
        const onLoaded = () => {
          try {
            if (sessionSongIdRef.current === state.currentSong.id) {
              const key = `resume_${state.currentSong.id}`;
              const stored = localStorage.getItem(key);
              if (stored) {
                const pos = parseInt(stored, 10);
                if (!isNaN(pos) && pos > 5 && pos < audio.duration - 5) {
                  audio.currentTime = pos;
                }
              }
            }
          } catch (e) {
            console.error('Error applying resume position', e);
          }
        };

        audio.addEventListener('loadedmetadata', onLoaded, { once: true });

        // Update session tracking
        sessionSongIdRef.current = state.currentSong.id;

        await audio.play().catch((err) => {
          console.warn('Autoplay prevented or audio play error:', err);
        });

        // Prefetch next song signed URL
        try {
          const playlist = state.currentPlaylist;
          if (playlist && Array.isArray(playlist.playlist)) {
            const idx = playlist.songIndex ?? playlist.playlist.findIndex(s => s.id === state.currentSong.id);
            const nextIndex = (idx + 1) % playlist.playlist.length;
            const nextSong = playlist.playlist[nextIndex];
            if (nextSong && nextSong.url && !/^https?:\/\//i.test(nextSong.url) && !signedUrlCache.current.has(nextSong.url)) {
              getSignedUrl(nextSong.url, 3600).then(signed => {
                signedUrlCache.current.set(nextSong.url, signed);
              }).catch(err => console.warn('Prefetch next signed url failed', err));
            }
          }
        } catch (err) {
          console.warn('Prefetch error', err);
        }

        if (!mounted) return;
        dispatch({ type: 'SET_PLAYING', payload: true });
      } catch (error) {
        console.error('Error setting up audio for currentSong:', error);
      }
    };

    setupAndPlay();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentSong]);

  // Auto-renew signed URL before expiry (1 hour TTL, refresh at 50 min)
  useEffect(() => {
    let mounted = true;
    const checkAndRenewUrl = async () => {
      if (!state.currentSong || state.isPlaying === false) return;
      try {
        const song = state.currentSong;
        const urlKey = song.url;
        // Check if URL is cached signed URL (in cache or if matches pattern)
        if (signedUrlCache.current.has(urlKey)) {
          // Renew at 50 minutes (3000 seconds)
          const newSigned = await getSignedUrl(urlKey, 3600);
          signedUrlCache.current.set(urlKey, newSigned);
          // Update audio source if currently playing
          if (mounted && state.audio && state.audio.src) {
            state.audio.src = newSigned;
          }
        }
      } catch (err) {
        console.warn('Auto-renew signed URL failed', err);
      }
    };

    const renewTimer = setInterval(checkAndRenewUrl, 3000000); // Every 50 minutes
    return () => {
      clearInterval(renewTimer);
      mounted = false;
    };
  }, [state.currentSong, state.isPlaying, state.audio]);

  // Persist resume position (debounced)
  useEffect(() => {
    const audio = state.audio;
    const savePosition = () => {
      try {
        const song = state.currentSong;
        if (!song) return;
        const key = `resume_${song.id}`;
        localStorage.setItem(key, Math.floor(audio.currentTime).toString());
      } catch (e) {
        console.error('Error saving resume position', e);
      }
    };

    const onTimeUpdate = () => {
      if (saveTimer.current) return;
      saveTimer.current = setTimeout(() => {
        savePosition();
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }, 3000);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('pause', savePosition);
    audio.addEventListener('ended', savePosition);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('pause', savePosition);
      audio.removeEventListener('ended', savePosition);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.currentSong, state.audio]);

  return (
    <PlayerContext.Provider value={{ state, dispatch }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
