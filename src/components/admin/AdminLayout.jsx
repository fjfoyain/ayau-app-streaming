import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import HomeIcon from '@mui/icons-material/Home';
import BusinessIcon from '@mui/icons-material/Business';
import StoreIcon from '@mui/icons-material/Store';
import Button from '@mui/material/Button';
import { supabase } from '../../lib/supabase';
import { getUserRole } from '../../services/supabase-api';
import ayauLogo from '../../assets/ayau-wordmark.png';

const drawerWidth = 280;

const allMenuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin', roles: ['admin', 'manager'] },
  { text: 'Cuentas', icon: <BusinessIcon />, path: '/admin/accounts', roles: ['admin', 'manager'] },
  { text: 'Locales', icon: <StoreIcon />, path: '/admin/venues', roles: ['admin', 'manager'] },
  { text: 'Playlists', icon: <QueueMusicIcon />, path: '/admin/playlists', roles: ['admin', 'manager'] },
  { text: 'Canciones', icon: <MusicNoteIcon />, path: '/admin/songs', roles: ['admin', 'manager'] },
  { text: 'Usuarios', icon: <PeopleIcon />, path: '/admin/users', roles: ['admin'] }, // Solo admins
  { text: 'Analytics', icon: <BarChartIcon />, path: '/admin/analytics', roles: ['admin', 'manager'] },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUserRole();
  }, []);

  const loadUserRole = async () => {
    try {
      const role = await getUserRole();
      setUserRole(role);
    } catch (error) {
      console.error('Error loading user role:', error);
      // Si hay error, asumir que es un usuario regular
      setUserRole('user');
    }
  };

  // Filter menu items based on user role
  // Mostrar todos los items si el rol aún no se ha cargado (evitar menú vacío)
  const menuItems = userRole
    ? allMenuItems.filter(item => !item.roles || item.roles.includes(userRole))
    : allMenuItems; // Mostrar todos mientras carga

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleBackToApp = () => {
    navigate('/');
  };

  const drawer = (
    <div className="h-full flex flex-col bg-black">
      <Toolbar sx={{ borderBottom: '2px solid #F4D03F', py: 2, justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
          <img src={ayauLogo} alt="AYAU" style={{ height: 36 }} />
          <Typography variant="caption" sx={{ color: '#F4D03F66', fontWeight: 'bold', letterSpacing: 2 }}>
            ADMIN
          </Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: '#F4D03F44' }} />
      <List sx={{ flexGrow: 1, pt: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <NavLink
              to={item.path}
              end={item.path === '/admin'}
              style={{ width: '100%', textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <ListItemButton
                  sx={{
                    mx: 1,
                    mb: 1,
                    borderRadius: '12px',
                    backgroundColor: isActive ? '#F4D03F22' : 'transparent',
                    border: isActive ? '2px solid #F4D03F' : '2px solid transparent',
                    '&:hover': {
                      backgroundColor: '#F4D03F11',
                      border: '2px solid #F4D03F66',
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: isActive ? '#F4D03F' : '#F4D03F99', minWidth: 45 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      '& .MuiListItemText-primary': {
                        color: isActive ? '#F4D03F' : '#F4D03F99',
                        fontWeight: isActive ? 'bold' : 'normal',
                      },
                    }}
                  />
                </ListItemButton>
              )}
            </NavLink>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ borderColor: '#F4D03F44' }} />
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<HomeIcon />}
          onClick={handleBackToApp}
          sx={{
            color: '#F4D03F',
            borderColor: '#F4D03F',
            mb: 1,
            '&:hover': {
              borderColor: '#F4D03F',
              backgroundColor: '#F4D03F22',
            },
          }}
        >
          Volver a la App
        </Button>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<ExitToAppIcon />}
          onClick={handleLogout}
          sx={{
            color: '#F4D03F',
            borderColor: '#F4D03F',
            '&:hover': {
              borderColor: '#F4D03F',
              backgroundColor: '#F4D03F22',
            },
          }}
        >
          Cerrar Sesión
        </Button>
      </Box>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#000' }}>
      {/* AppBar for mobile */}
      <AppBar
        position="fixed"
        sx={{
          display: { sm: 'none' },
          backgroundColor: '#000',
          borderBottom: '2px solid #F4D03F',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, color: '#F4D03F' }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <img src={ayauLogo} alt="AYAU" style={{ height: 24 }} />
            <Typography variant="caption" sx={{ color: '#F4D03F66', fontWeight: 'bold', letterSpacing: 2 }}>
              ADMIN
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: '#000',
              borderRight: '2px solid #F4D03F',
            },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: '#000',
              borderRight: '2px solid #F4D03F',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: { xs: 8, sm: 0 },
          backgroundColor: '#000',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
