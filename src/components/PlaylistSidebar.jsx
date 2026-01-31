import Button from '@mui/material/Button';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloseIcon from '@mui/icons-material/Close';
import PauseIcon from "@mui/icons-material/Pause";
import CircularProgress from '@mui/material/CircularProgress';
import { usePlayer } from "../context/PlayerContext";
import { useEffect, useState } from "react";
import { getPlaylistSongs } from '../services/supabase-api';
import { formatDuration } from '../utils/musicPlayer';

export default function PlaylistSidebar({ playlist, onClose }) {
  const { state, dispatch } = usePlayer();
  const [songs, setSongs] = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(false);

  useEffect(() => {
    if (playlist?.id) {
      fetchSongs(playlist.id);
    }
  }, [playlist]);

  const fetchSongs = async (playlistId) => {
    setLoadingSongs(true);
    try {
      const songs = await getPlaylistSongs(playlistId);
      setSongs(songs);
    } catch (error) {
      console.error("Error fetching songs:", error);
      setSongs([]);
    } finally {
      setLoadingSongs(false);
    }
  };

  const handlePlay = (e, song, index) => {
    if (state.currentSong?.id === song.id) {
      // Same song - just toggle play/pause
      dispatch({ type: "TOGGLE_PLAY_PAUSE" });
    } else {
      // Different song - load and play
      dispatch({
        type: "PLAY_SONG",
        payload: { ...song, url: song.url },
        playlistInfo: { playlist: songs, songIndex: index }
      });
    }
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full w-3/5 lg:w-[calc(50%-5%)] bg-black border-l-2 border-ayau-gold
        transition-transform duration-300 ease-in-out z-50 ${playlist ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className='flex justify-between items-center p-6 border-b-2 border-ayau-gold'>
        <h1 className="text-4xl lg:text-6xl text-ayau-gold font-bold uppercase tracking-tight">
          {playlist?.name || 'Playlist'}
        </h1>
        <Button
          onClick={onClose}
          sx={{
            color: '#F4D03F',
            minWidth: 'auto',
            padding: '8px',
            '&:hover': {
              backgroundColor: '#F4D03F22',
            }
          }}
        >
          <CloseIcon fontSize="large" />
        </Button>
      </div>

      {/* Contenido del Sidebar */}
      <div className="p-6 lg:p-10 h-[calc(100%-120px)] overflow-y-auto">
        {loadingSongs ? (
          <div className="flex justify-center items-center w-full h-full">
            <CircularProgress sx={{ color: '#F4D03F' }} size={60} />
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center text-ayau-gold/60 mt-10 border-2 border-ayau-gold/30 rounded-xl p-8">
            <p className="text-xl">No hay canciones en esta playlist</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {songs.map((song, index) => (
              <li
                key={song.id || index}
                className={`p-4 lg:p-5 bg-black border-2 transition-all duration-300
                  text-ayau-gold shadow-lg flex items-center justify-between rounded-xl cursor-pointer
                  ${state.currentSong?.id === song.id ? 'border-ayau-gold bg-ayau-gold/5' : 'border-ayau-gold/40'}
                  hover:border-ayau-gold hover:bg-ayau-gold/5 hover:shadow-xl`}
              >
                <div className='flex items-center gap-4 flex-1 min-w-0'>
                  <Button
                    onClick={(e) => handlePlay(e, song, index)}
                    sx={{
                      minWidth: 'auto',
                      padding: '8px',
                      color: state.currentSong?.id === song.id && state.isPlaying ? '#F4D03F' : '#F4D03F',
                      '&:hover': {
                        backgroundColor: '#F4D03F22',
                      }
                    }}
                  >
                    {state.currentSong?.id === song.id && state.isPlaying ? (
                      <PauseIcon fontSize="large" />
                    ) : (
                      <PlayArrowIcon fontSize="large" />
                    )}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-lg truncate">{song.title}</div>
                    <div className="text-sm text-ayau-gold/70 truncate">{song.performer}</div>
                  </div>
                </div>
                <div className='text-ayau-gold/60 text-sm font-mono px-3'>
                  {formatDuration(song.duration)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
