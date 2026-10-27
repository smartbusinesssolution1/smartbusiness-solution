import React, { useState, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { getAvatarUrl } from '../utils/imageUrl';
import BrandLoader from '../components/BrandLoader';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  useTheme,
  useMediaQuery,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon,
  ExitToApp as ExitToAppIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';

const DRAWER_WIDTH = 270;
const COLLAPSED_WIDTH = 76;

export const DashboardLayout: React.FC = () => {
  const { user, isSuperAdmin, logout } = useAuth();
  const { mode, toggleTheme } = useAppTheme();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const collapsed = !isMobile && isCollapsed;
  const currentDrawerWidth = isMobile ? 0 : (isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH);

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogoutClick = async () => {
    handleProfileMenuClose();
    await logout();
    navigate('/login');
  };

  const handleProfileNavigate = () => {
    handleProfileMenuClose();
    navigate('/admin/profile');
  };

  // Sidebar navigation items for Admin console
  const menuItems = [
    { text: 'Admin Dashboard', icon: <DashboardIcon />, path: '/admin/dashboard' },
    { text: 'Employee Directory', icon: <PeopleIcon />, path: '/admin/employees' },
    { text: 'Attendance Reports', icon: <AssessmentIcon />, path: '/admin/reports' },
    { text: 'Organization', icon: <SettingsIcon />, path: '/admin/settings' },
    { text: 'My Profile', icon: <PersonIcon />, path: '/admin/profile' },
  ];

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowX: 'hidden' }}>
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          px: collapsed ? 1 : 2,
          py: 1.5,
          minHeight: '64px !important',
        }}
      >
        <Box
          onClick={() => navigate('/admin/dashboard')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <Box
            component="img"
            src="/icon.png"
            alt="Clock-in Clock-Out"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              objectFit: 'contain',
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <Typography
              variant="subtitle1"
              noWrap
              sx={{
                fontWeight: 800,
                color: 'text.primary',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.3px',
                fontSize: '1rem',
              }}
            >
              Clock-in Clock-Out
            </Typography>
          )}
        </Box>

        {!collapsed && !isMobile && (
          <IconButton
            size="small"
            onClick={() => setIsCollapsed(true)}
            sx={{
              color: 'text.secondary',
              p: 0.5,
              '&:hover': { color: 'text.primary' },
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
        )}
      </Toolbar>
      <Divider />

      {/* Current User Quick Info */}
      <Box
        sx={{
          p: collapsed ? 1.5 : 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1.5,
        }}
      >
        <Tooltip title={collapsed ? (user?.name || '') : ''} placement="right">
          <Avatar
            src={getAvatarUrl(user?.avatarUrl)}
            alt={user?.name}
            sx={{
              width: collapsed ? 40 : 48,
              height: collapsed ? 40 : 48,
              border: `2px solid ${theme.palette.primary.main}`,
            }}
          />
        </Tooltip>
        {!collapsed && (
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AdminIcon sx={{ fontSize: 14, color: theme.palette.secondary.main }} />
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                {isSuperAdmin ? 'Super Administrator' : user?.role === 'admin' ? 'Administrator' : 'Administrator'}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      <Divider />

      <List sx={{ px: collapsed ? 1 : 1.5, py: 2, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip title={collapsed ? item.text : ''} placement="right">
                <ListItemButton
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                  }}
                  onMouseEnter={() => {
                    // Preload route chunk on hover for instant 0ms transition
                    if (item.path === '/admin/employees') import('../pages/admin/EmployeeList');
                    else if (item.path === '/admin/dashboard') import('../pages/admin/AdminDashboard');
                    else if (item.path === '/admin/reports') import('../pages/admin/AttendanceReport');
                    else if (item.path === '/admin/settings') import('../pages/admin/OrganizationSettings');
                  }}
                  sx={{
                    borderRadius: 2,
                    py: 1.25,
                    px: collapsed ? 1.25 : 2,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    transition: 'all 0.15s ease-in-out',
                    backgroundColor: isActive
                      ? (theme.palette.mode === 'light' ? '#EEF2FF' : 'rgba(99, 102, 241, 0.16)')
                      : 'transparent',
                    color: isActive
                      ? (theme.palette.mode === 'light' ? '#3730A3' : '#C7D2FE')
                      : theme.palette.text.primary,
                    '&:hover': {
                      backgroundColor: isActive
                        ? (theme.palette.mode === 'light' ? '#E0E7FF' : 'rgba(99, 102, 241, 0.24)')
                        : (theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)'),
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 'auto' : 40,
                      justifyContent: 'center',
                      color: isActive
                        ? (theme.palette.mode === 'light' ? '#4F46E5' : '#818CF8')
                        : theme.palette.text.secondary,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 700 : 500,
                            color: 'inherit',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.text}
                        </Typography>
                      }
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      <Box sx={{ p: collapsed ? 1 : 2 }}>
        <Tooltip title={collapsed ? 'Sign Out' : ''} placement="right">
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            startIcon={collapsed ? undefined : <ExitToAppIcon />}
            onClick={handleLogoutClick}
            sx={{
              borderColor: theme.palette.divider,
              color: theme.palette.text.secondary,
              py: 1,
              minWidth: collapsed ? 'auto' : undefined,
              px: collapsed ? 1 : 2,
              justifyContent: 'center',
              '&:hover': {
                borderColor: theme.palette.error.main,
                color: theme.palette.error.main,
                backgroundColor: theme.palette.mode === 'light' ? '#fef2f2' : 'rgba(239, 68, 68, 0.08)',
              }
            }}
          >
            {collapsed ? <ExitToAppIcon fontSize="small" /> : 'Sign Out'}
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: { xs: 0.5, sm: 1 }, display: { md: isCollapsed ? 'inline-flex' : 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Box
              component="img"
              src="/icon.png"
              alt="Clock In Clock Out"
              sx={{ height: 32, width: 32, objectFit: 'contain', display: { xs: 'none', sm: 'block', md: 'none' } }}
            />
            {/* Workspace / Branch Switcher */}
            <WorkspaceSwitcher />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Theme Toggle */}
            <Tooltip title={`Toggle ${mode === 'light' ? 'Dark' : 'Light'} Mode`}>
              <IconButton onClick={toggleTheme} color="inherit" sx={{ border: `1px solid ${theme.palette.divider}`, p: 1 }}>
                {mode === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
              </IconButton>
            </Tooltip>

            {/* User Dropdown */}
            <Tooltip title="Account settings">
              <IconButton onClick={handleProfileMenuOpen} size="small" sx={{ p: 0.5 }}>
                <Avatar src={getAvatarUrl(user?.avatarUrl)} alt={user?.name} sx={{ width: 36, height: 36 }} />
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleProfileMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1.5,
                    minWidth: 180,
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                    border: `1px solid ${theme.palette.divider}`,
                  },
                },
              }}
            >
              <MenuItem onClick={handleProfileNavigate}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Admin Profile" />
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogoutClick} sx={{ color: theme.palette.error.main }}>
                <ListItemIcon sx={{ color: theme.palette.error.main }}>
                  <ExitToAppIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Sign Out" />
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer System */}
      <Box
        component="nav"
        sx={{
          width: { md: currentDrawerWidth },
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
        aria-label="mailbox folders"
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, borderRight: `1px solid ${theme.palette.divider}` },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: currentDrawerWidth,
              borderRight: `1px solid ${theme.palette.divider}`,
              overflowX: 'hidden',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Stage */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2.5, sm: 4 },
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Toolbar /> {/* Spacer for top AppBar */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Suspense fallback={<BrandLoader fullScreen message="Loading workspace view..." />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
};

export default DashboardLayout;
