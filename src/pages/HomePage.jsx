import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getUserPlaylists, isManagerOrAdmin, getPlaylistSongsFast, getCurrentUserProfile } from "../services/supabase-api";
import MusicPlayer from "../components/MusicPlayer";
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CircularProgress from '@mui/material/CircularProgress';
import { usePlayer } from "../context/PlayerContext";
import DJModePanel from "../components/DJModePanel";
import ayauLogo from "../assets/ayau-wordmark.png";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [queueOpen, setQueueOpen] = useState(false);

  useEffect(() => {
    if (session?.user) {
      checkActiveStatus();
      fetchPlaylists();
      checkAdminStatus();
    }
  }, [session]);

  const checkActiveStatus = async () => {
    try {
      const profile = await getCurrentUserProfile();
      if (profile && profile.is_active === false) {
        // User has been deactivated — sign out immediately
        await supabase.auth.signOut();
      }
    } catch {
      // If we can't fetch the profile, allow access (fail open)
    }
  };

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
    // Stop audio and clear player state before logout
    if (state.audio) {
      state.audio.pause();
      state.audio.currentTime = 0;
      state.audio.src = '';
    }
    dispatch({ type: "SET_CURRENT_SONG", payload: null });

    await supabase.auth.signOut();
    setDropdownOpen(false);
  };

  const handleGoToAdmin = () => {
    navigate('/admin');
    setDropdownOpen(false);
  };

  const handlePlayPlaylist = async (playlist) => {
    setSidebarOpen(false);

    try {
      // Fast load: single DB query, no cover URL signing (covers resolve lazily per song)
      const songs = await getPlaylistSongsFast(playlist.id);

      if (songs.length === 0) {
        alert('Esta playlist no tiene canciones');
        return;
      }

      const shuffledSongs = shuffleArray(songs);

      dispatch({
        type: "PLAY_SONG",
        payload: shuffledSongs[0],
        playlistInfo: { playlist: shuffledSongs, songIndex: 0 }
      });
    } catch (error) {
      console.error("Error loading playlist:", error);
      alert('Error al cargar la playlist');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* DJ Mode Panel (floating) */}
      <DJModePanel />

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
          <img src={ayauLogo} alt="AYAU" className="h-8 lg:h-10" />
          <span className="text-sm text-ayau-gold/60 hidden lg:block tracking-wider">
            MÚSICA, ON FIRE
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state.currentPlaylist?.playlist && (
            <IconButton
              onClick={() => setQueueOpen(!queueOpen)}
              title="Ver cola de reproducción"
              sx={{
                color: queueOpen ? '#F4D03F' : '#F4D03F66',
                backgroundColor: queueOpen ? '#F4D03F22' : 'transparent',
                '&:hover': { backgroundColor: '#F4D03F22' }
              }}
            >
              <QueueMusicIcon />
            </IconButton>
          )}
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
                      '&:hover': { backgroundColor: '#F4D03F22' }
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
                    '&:hover': { backgroundColor: '#F4D03F22' }
                  }}
                >
                  Cerrar Sesión
                </Button>
              </div>
            )}
          </div>
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
                    disabled={false}
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

        {/* Queue Panel - Right side, informative only */}
        {(() => {
          const { playlist, songIndex } = state.currentPlaylist || {};
          if (!playlist) return null;
          const upcoming = [
            ...playlist.slice(songIndex + 1),
            ...playlist.slice(0, songIndex),
          ];
          return (
            <div
              className={`fixed right-0 top-[73px] bottom-[200px] w-72 bg-black border-l-2 border-ayau-gold transition-transform duration-300 ease-in-out z-40 flex flex-col ${
                queueOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="flex justify-between items-center p-4 border-b-2 border-ayau-gold flex-shrink-0">
                <h2 className="text-lg font-bold text-ayau-gold uppercase tracking-wider">
                  En cola
                </h2>
                <IconButton
                  onClick={() => setQueueOpen(false)}
                  sx={{ color: '#F4D03F', '&:hover': { backgroundColor: '#F4D03F22' } }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>

              <div className="overflow-y-auto flex-1 p-3 space-y-1">
                {/* Current song */}
                <p className="text-xs font-bold text-ayau-gold/50 uppercase tracking-widest px-2 pb-1">
                  Reproduciendo
                </p>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-ayau-gold/10 border border-ayau-gold/40">
                  <div className="w-10 h-10 rounded-md overflow-hidden border border-ayau-gold/60 flex-shrink-0 bg-black flex items-center justify-center">
                    {playlist[songIndex]?.coverImage
                      ? <img src={playlist[songIndex].coverImage} alt="" className="w-full h-full object-cover" />
                      : <MusicNoteIcon sx={{ color: '#F4D03F66', fontSize: '1.2rem' }} />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ayau-gold truncate">{playlist[songIndex]?.title}</p>
                    <p className="text-xs text-ayau-gold/60 truncate">{playlist[songIndex]?.performer}</p>
                  </div>
                </div>

                {/* Upcoming songs */}
                {upcoming.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-ayau-gold/50 uppercase tracking-widest px-2 pt-3 pb-1">
                      Siguientes
                    </p>
                    {upcoming.map((song, i) => (
                      <div
                        key={`${song.id}-${i}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-ayau-gold/5 transition-colors"
                      >
                        <span className="text-xs text-ayau-gold/30 w-5 text-right flex-shrink-0">{i + 1}</span>
                        <div className="w-9 h-9 rounded-md overflow-hidden border border-ayau-gold/30 flex-shrink-0 bg-black flex items-center justify-center">
                          {song.coverImage
                            ? <img src={song.coverImage} alt="" className="w-full h-full object-cover" />
                            : <MusicNoteIcon sx={{ color: '#F4D03F44', fontSize: '1rem' }} />
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ayau-gold/90 truncate">{song.title}</p>
                          <p className="text-xs text-ayau-gold/50 truncate">{song.performer}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Central Content - Now Playing */}
        <div className="flex-1 flex items-center justify-center p-3 md:p-6 overflow-hidden">
          {state.currentSong ? (
            <div className="flex flex-col items-center w-full">
              {/* Cover Art — width = min(85vw, available-height minus header+footer+info) */}
              <div
                className="aspect-square flex-shrink-0 rounded-2xl md:rounded-3xl overflow-hidden border-2 md:border-4 border-ayau-gold shadow-2xl shadow-ayau-gold/20 bg-black mb-3 md:mb-4"
                style={{ width: 'min(85vw, calc(100vh - 460px))' }}
              >
                <img
                  src={state.currentSong.coverImage || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23000'/%3E%3Ctext x='150' y='150' font-family='Arial' font-size='60' fill='%23F4D03F' text-anchor='middle' dominant-baseline='middle'%3E%E2%99%AB%3C/text%3E%3C/svg%3E"}
                  alt={state.currentSong.title}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Song Info — same max-width as cover so text aligns */}
              <div
                className="text-center px-2 flex-shrink-0"
                style={{ width: 'min(85vw, calc(100vh - 460px))' }}
              >
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-ayau-gold mb-1 truncate">
                  {state.currentSong.title}
                </h1>
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-ayau-gold/80 truncate">
                  {state.currentSong.performer}
                </p>
                {state.currentSong.author && (() => {
                  // author may be stored as a JSON array string e.g. ["Author 1","Author 2"]
                  let display = state.currentSong.author;
                  try {
                    const parsed = JSON.parse(display);
                    if (Array.isArray(parsed)) display = parsed.filter(Boolean).join(', ');
                  } catch (_) { /* not JSON, use as-is */ }
                  return display ? (
                    <p className="text-xs sm:text-sm md:text-base text-ayau-gold/60 mt-1 truncate">
                      {display}
                    </p>
                  ) : null;
                })()}
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
