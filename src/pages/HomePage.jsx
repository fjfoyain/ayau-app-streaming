import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getUserPlaylists, isManagerOrAdmin, getPlaylistSongs } from "../services/supabase-api";
import MusicPlayer from "../components/MusicPlayer";
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CircularProgress from '@mui/material/CircularProgress';
import { usePlayer } from "../context/PlayerContext";

// Utility function to shuffle array
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function HomePage({ session }) {
  const navigate = useNavigate();
  const { state, dispatch } = usePlayer();
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchPlaylists();
      checkAdminStatus();
    }
  }, [session]);

  const fetchPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const data = await getUserPlaylists();
      setPlaylists(data || []);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      setPlaylists([]);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const hasAccess = await isManagerOrAdmin();
      setUserIsAdmin(hasAccess);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
  };

  const handleGoToAdmin = () => {
    navigate('/admin');
    setDropdownOpen(false);
  };

  const handlePlayPlaylist = async (playlist) => {
    setLoadingPlaylist(true);
    setSidebarOpen(false);

    try {
      // Fetch all songs from the playlist
      const songs = await getPlaylistSongs(playlist.id);

      if (songs.length === 0) {
        alert('Esta playlist no tiene canciones');
        return;
      }

      // Shuffle the songs for fair distribution
      const shuffledSongs = shuffleArray(songs);

      // Start playing the first song in the shuffled playlist
      dispatch({
        type: "PLAY_SONG",
        payload: shuffledSongs[0],
        playlistInfo: { playlist: shuffledSongs, songIndex: 0 }
      });
    } catch (error) {
      console.error("Error loading playlist:", error);
      alert('Error al cargar la playlist');
    } finally {
      setLoadingPlaylist(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <header className="p-4 bg-black border-b-2 border-ayau-gold flex justify-between items-center z-50">
        <div className="flex items-center gap-4">
          <IconButton
            onClick={() => setSidebarOpen(!sidebarOpen)}
            sx={{
              color: '#F4D03F',
              '&:hover': { backgroundColor: '#F4D03F22' }
            }}
          >
            <MenuIcon fontSize="large" />
          </IconButton>
          <h1 className="text-3xl lg:text-4xl font-bold text-ayau-gold tracking-tight">
            AYAU
          </h1>
          <span className="text-sm text-ayau-gold/80 hidden lg:block">
            MÚSICA, ON FIRE
          </span>
        </div>
        <div className="relative">
          <Button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            sx={{
              color: '#F4D03F',
              border: '2px solid #F4D03F',
              borderRadius: '50%',
              minWidth: 'auto',
              padding: '8px',
              '&:hover': {
                backgroundColor: '#F4D03F22',
                border: '2px solid #F4D03F',
              }
            }}
          >
            <PersonIcon />
          </Button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border-2 border-ayau-gold rounded-lg shadow-xl py-2 z-50">
              <div className="px-4 py-3 text-sm text-ayau-gold border-b border-ayau-gold/30">
                {session.user.email}
              </div>
              {userIsAdmin && (
                <Button
                  onClick={handleGoToAdmin}
                  startIcon={<SettingsIcon />}
                  sx={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    color: '#F4D03F',
                    padding: '12px 16px',
                    '&:hover': {
                      backgroundColor: '#F4D03F22',
                    }
                  }}
                >
                  Panel de Admin
                </Button>
              )}
              <Button
                onClick={handleLogout}
                sx={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  color: '#F4D03F',
                  padding: '12px 16px',
                  '&:hover': {
                    backgroundColor: '#F4D03F22',
                  }
                }}
              >
                Cerrar Sesión
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Sidebar - Playlists */}
        <div
          className={`fixed left-0 top-[73px] bottom-[200px] w-80 bg-black border-r-2 border-ayau-gold transition-transform duration-300 ease-in-out z-40 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex justify-between items-center p-4 border-b-2 border-ayau-gold">
            <h2 className="text-2xl font-bold text-ayau-gold uppercase">
              Playlists
            </h2>
            <IconButton
              onClick={() => setSidebarOpen(false)}
              sx={{
                color: '#F4D03F',
                '&:hover': { backgroundColor: '#F4D03F22' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </div>

          <div className="overflow-y-auto h-full p-4">
            {loadingPlaylists ? (
              <div className="flex justify-center items-center h-64">
                <CircularProgress sx={{ color: '#F4D03F' }} size={40} />
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center text-ayau-gold/60 mt-10 p-6 border-2 border-ayau-gold/30 rounded-lg">
                <p className="text-lg font-bold mb-2">No tienes playlists</p>
                <p className="text-sm">Contacta al administrador</p>
              </div>
            ) : (
              <div className="space-y-2">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => handlePlayPlaylist(playlist)}
                    disabled={loadingPlaylist}
                    className="w-full text-left p-4 rounded-lg border-2 border-ayau-gold/40 bg-black hover:bg-ayau-gold/10 hover:border-ayau-gold transition-all duration-200 flex items-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-12 h-12 rounded-lg bg-ayau-gold/20 flex items-center justify-center border-2 border-ayau-gold/40 group-hover:border-ayau-gold transition-colors">
                      <PlayArrowIcon sx={{ color: '#F4D03F', fontSize: '2rem' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-ayau-gold truncate">{playlist.name}</p>
                      {playlist.description && (
                        <p className="text-sm text-ayau-gold/70 truncate">{playlist.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Central Content - Now Playing */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden">
          {state.currentSong ? (
            <div className="flex flex-col items-center w-full max-w-4xl">
              {/* Large Cover Art - Responsive */}
              <div className="w-full max-w-[90vw] md:max-w-md lg:max-w-lg xl:max-w-xl aspect-square mb-4 md:mb-8 rounded-2xl md:rounded-3xl overflow-hidden border-2 md:border-4 border-ayau-gold shadow-2xl shadow-ayau-gold/20">
                <img
                  src={state.currentSong.coverImage || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23000'/%3E%3Ctext x='150' y='150' font-family='Arial' font-size='60' fill='%23F4D03F' text-anchor='middle' dominant-baseline='middle'%3E%E2%99%AB%3C/text%3E%3C/svg%3E"}
                  alt={state.currentSong.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Song Info - Responsive */}
              <div className="text-center w-full px-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-ayau-gold mb-1 md:mb-2 truncate">
                  {state.currentSong.title}
                </h1>
                <p className="text-xl sm:text-2xl md:text-3xl text-ayau-gold/80 truncate">
                  {state.currentSong.performer}
                </p>
                {state.currentSong.author && (
                  <p className="text-sm sm:text-base md:text-lg text-ayau-gold/60 mt-1 md:mt-2 truncate">
                    {state.currentSong.author}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center px-4">
              <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 mx-auto mb-6 md:mb-8 rounded-full bg-gradient-to-br from-ayau-gold/20 to-ayau-gold/5 flex items-center justify-center border-4 border-ayau-gold/30">
                <span className="text-7xl sm:text-8xl md:text-9xl">🎵</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-ayau-gold mb-3 md:mb-4">
                Selecciona una playlist
              </h2>
              <p className="text-lg sm:text-xl text-ayau-gold/60">
                Abre el menú lateral para comenzar a reproducir
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer (Music Player) */}
      <MusicPlayer />
    </div>
  );
}
