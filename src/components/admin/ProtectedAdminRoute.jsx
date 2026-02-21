import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { isManagerOrAdmin, isAdmin } from '../../services/supabase-api';

export default function ProtectedAdminRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const result = await isManagerOrAdmin();
      setHasAccess(result);
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#000',
        }}
      >
        <CircularProgress sx={{ color: '#F4D03F' }} size={60} />
      </Box>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return children;
}

const loadingBox = (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#000' }}>
    <CircularProgress sx={{ color: '#F4D03F' }} size={60} />
  </Box>
);

/** Restricts a route to admin-only (not managers). Redirects to /admin on unauthorized access. */
export function AdminOnlyRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    isAdmin()
      .then(setHasAccess)
      .catch(() => setHasAccess(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return loadingBox;
  if (!hasAccess) return <Navigate to="/admin" replace />;
  return children;
}
