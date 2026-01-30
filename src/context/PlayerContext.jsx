import { createContext, useReducer, useContext } from "react";

const initialState = {
  currentSong: null,
  isPlaying: false,
  currentPlaylist: null, // { playlist: [...songs], songIndex: 0 }
  audio: (() => {
    const audio = new Audio();
    audio.volume = 0.5;
    return audio;
  })(),
};

const playerReducer = (state, action) => {
  switch (action.type) {
    case "PLAY_SONG":
      try {
        state.audio.pause();
        state.audio.src = action.payload.url;
        state.audio.load();
        state.audio.play().catch((error) => {
          console.error("Error playing audio:", error);
        });

        return {
          ...state,
          currentSong: action.payload,
          isPlaying: true,
          currentPlaylist: action.playlistInfo || state.currentPlaylist
        };
      } catch (error) {
        console.error("Error in PLAY_SONG action:", error);
        return state;
      }

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
      try {
        state.audio.pause();
        state.audio.src = action.payload.url;
        state.audio.load();
        state.audio.play().catch((error) => {
          console.error("Error playing audio:", error);
        });

        // Update song index in current playlist
        const newPlaylist = state.currentPlaylist ? {
          ...state.currentPlaylist,
          songIndex: state.currentPlaylist.playlist.findIndex(s => s.id === action.payload.id)
        } : null;

        return {
          ...state,
          currentSong: action.payload,
          isPlaying: true,
          currentPlaylist: newPlaylist
        };
      } catch (error) {
        console.error(`Error in ${action.type} action:`, error);
        return state;
      }

    default:
      return state;
  }
};

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(playerReducer, initialState);

  return (
    <PlayerContext.Provider value={{ state, dispatch }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
