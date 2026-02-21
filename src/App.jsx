import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import Loading from "./components/Loading";
import HomePage from "./pages/HomePage";
import PasswordReset from "./pages/PasswordReset";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./components/admin/AdminDashboard";
import AccountManager from "./components/admin/AccountManager";
import VenueManager from "./components/admin/VenueManager";
import PlaylistManager from "./components/admin/PlaylistManager";
import SongManager from "./components/admin/SongManager";
import UserManager from "./components/admin/UserManager";
import AnalyticsDashboard from "./components/admin/AnalyticsDashboard";
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";
import { PlayerProvider } from "./context/PlayerContext";
import { SyncPlaybackProvider } from "./context/SyncPlaybackContext";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <ErrorBoundary>
    <Router>
      <Routes>
        {/* Public routes (no authentication required) */}
        <Route path="/password-reset" element={<PasswordReset />} />

        {/* Authentication required routes */}
        {session ? (
          <>
            <Route path="/" element={<PlayerProvider><SyncPlaybackProvider><HomePage session={session} /></SyncPlaybackProvider></PlayerProvider>} />

            {/* Admin Routes (protected) */}
            <Route
              path="/admin"
              element={
                <PlayerProvider>
                  <SyncPlaybackProvider>
                    <ProtectedAdminRoute>
                      <AdminLayout />
                    </ProtectedAdminRoute>
                  </SyncPlaybackProvider>
                </PlayerProvider>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="accounts" element={<AccountManager />} />
              <Route path="venues" element={<VenueManager />} />
              <Route path="playlists" element={<PlaylistManager />} />
              <Route path="songs" element={<SongManager />} />
              <Route path="users" element={<UserManager />} />
              <Route path="analytics" element={<AnalyticsDashboard />} />
            </Route>

            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <Route path="*" element={<Login />} />
        )}
      </Routes>
    </Router>
    </ErrorBoundary>
  );
}
