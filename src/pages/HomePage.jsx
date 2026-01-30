import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getUserPlaylists, isManagerOrAdmin } from "../services/supabase-api";
import PlaylistCard from "../components/PlaylistCard";
import PlaylistSidebar from "../components/PlaylistSidebar";
import MusicPlayer from "../components/MusicPlayer";
import Button from '@mui/material/Button';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import CircularProgress from '@mui/material/CircularProgress';

export default function HomePage({ session }) {
  const navigate = useNavigate();
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

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

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header estilo AYAU */}
      <header className="p-6 bg-black border-b-2 border-ayau-gold flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl lg:text-5xl font-bold text-ayau-gold tracking-tight">
            AYAU
          </h1>
          <span className="text-sm lg:text-base text-ayau-gold/80 hidden lg:block">
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
      <div className="flex-1 overflow-hidden flex">
        {/* Playlists Section */}
        <div className={`px-8 lg:px-20 py-10 flex flex-col overflow-y-auto transition-all duration-300 ${selectedPlaylist ? "w-1/2" : "w-full"}`}>
          <h2 className="text-5xl lg:text-7xl text-ayau-gold mb-8 font-bold uppercase tracking-tight">
            Playlists
          </h2>

          <main className="flex flex-wrap gap-6 lg:gap-10">
            {loadingPlaylists ? (
              <div className="flex justify-center items-center w-full h-64">
                <CircularProgress sx={{ color: '#F4D03F' }} size={60} />
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center text-ayau-gold/60 w-full mt-10 border-2 border-ayau-gold/30 rounded-2xl p-12">
                <p className="text-2xl font-bold mb-2">No tienes playlists asignadas</p>
                <p className="text-base">Contacta al administrador para obtener acceso</p>
              </div>
            ) : (
              playlists.map((playlist, index) => (
                <PlaylistCard
                  key={playlist.id || index}
                  playlist={playlist}
                  onSelect={setSelectedPlaylist}
                />
              ))
            )}
          </main>
        </div>

        {/* Sidebar */}
        <PlaylistSidebar
          playlist={selectedPlaylist}
          onClose={() => setSelectedPlaylist(null)}
        />
      </div>

      {/* Footer (Music Player) */}
      <MusicPlayer />
    </div>
  );
}
