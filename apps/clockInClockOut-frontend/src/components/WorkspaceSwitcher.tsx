import React, { useState } from 'react';
import {
  Box,
  Typography,
  ButtonBase,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  Snackbar,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { useAuth } from '../context/AuthContext';
import { Workspace } from '../types';

// ── Role badge helpers ──────────────────────────────────────────────────────
type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

const SWITCHER_ROLE_BADGES: Record<WorkspaceRole, { label: string; lightBg: string; lightColor: string; darkBg: string; darkColor: string }> = {
  OWNER: { label: 'Owner', lightBg: '#FFF7ED', lightColor: '#C2410C', darkBg: 'rgba(251,146,60,0.22)', darkColor: '#FDBA74' },
  ADMIN: { label: 'Admin', lightBg: '#EEF2FF', lightColor: '#3730A3', darkBg: 'rgba(129,140,248,0.22)', darkColor: '#C7D2FE' },
  MEMBER: { label: 'Member', lightBg: '#F1F5F9', lightColor: '#475569', darkBg: 'rgba(255,255,255,0.08)', darkColor: '#94A3B8' },
};

const SwitcherRoleBadge: React.FC<{ role: WorkspaceRole; isDark: boolean }> = ({ role, isDark }) => {
  const cfg = SWITCHER_ROLE_BADGES[role] ?? SWITCHER_ROLE_BADGES.MEMBER;
  return (
    <Box
      sx={{
        px: 0.75,
        py: 0.2,
        borderRadius: 1,
        bgcolor: isDark ? cfg.darkBg : cfg.lightBg,
        color: isDark ? cfg.darkColor : cfg.lightColor,
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.01em',
        flexShrink: 0,
        lineHeight: 1.5,
      }}
    >
      {cfg.label}
    </Box>
  );
};

export const WorkspaceSwitcher: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant, workspaces, currentWorkspace, switchWorkspace, isSuperAdmin } = useAuth();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isOwner = Boolean(currentTenant?.role === 'OWNER' || isSuperAdmin);
  const isDark = theme.palette.mode === 'dark';

  const getWorkspaceRole = (ws: Workspace): WorkspaceRole => {
    const raw = (ws.role || ws.userRole || (isOwner ? 'OWNER' : 'MEMBER')).toUpperCase();
    if (raw === 'OWNER') return 'OWNER';
    if (raw === 'ADMIN') return 'ADMIN';
    return 'MEMBER';
  };

  // Only consider workspaces where the user has an administrative role ('OWNER' or 'ADMIN')
  const visibleWorkspaces = (workspaces || []).filter((ws) => {
    const role = getWorkspaceRole(ws);
    return role === 'OWNER' || role === 'ADMIN';
  });

  // Visibility Rule:
  // - Organization Owner: show dropdown if they have workspaces
  // - Admin: ONLY show dropdown if they have MULTIPLE workspaces as Admin. If only 1, do NOT show dropdown.
  // - Member/Employee: never show dropdown.
  const canShowDropdown = isOwner ? visibleWorkspaces.length > 0 : visibleWorkspaces.length > 1;

  if (!canShowDropdown) {
    return null;
  }

  const isOpen = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectWorkspace = async (ws: Workspace) => {
    if (currentWorkspace?.id === ws.id) {
      handleClose();
      return;
    }
    try {
      await switchWorkspace(ws.id);
      await queryClient.invalidateQueries();
      setToastMessage(`Active workspace: ${ws.name}`);
    } catch {
      setToastMessage(`Failed to switch workspace`);
    } finally {
      handleClose();
    }
  };

  const handleManageWorkspaces = () => {
    handleClose();
    navigate('/workspace/select');
  };

  // Company monogram helper
  const companyName = currentTenant?.name || 'Organization';
  const hasWorkspace = Boolean(workspaces && workspaces.length > 0 && (currentWorkspace?.name || workspaces[0]?.name));
  const activeWorkspaceName = currentWorkspace?.name || workspaces?.[0]?.name || '';

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Topbar Trigger Button: Company Name (top) + Active Workspace (bottom) */}
      <ButtonBase
        onClick={handleOpen}
        aria-label="Select Workspace / Branch"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.5,
          py: 0.75,
          borderRadius: 2.75, // rounded-xl
          border: `1px solid ${
            isOpen ? theme.palette.primary.main : theme.palette.divider
          }`,
          backgroundColor: isOpen
            ? theme.palette.mode === 'light'
              ? alpha(theme.palette.primary.main, 0.06)
              : alpha(theme.palette.primary.main, 0.16)
            : theme.palette.mode === 'light'
            ? '#FFFFFF'
            : alpha(theme.palette.background.paper, 0.8),
          transition: 'all 0.15s ease-in-out',
          cursor: 'pointer',
          textAlign: 'left',
          '&:hover': {
            backgroundColor:
              theme.palette.mode === 'light'
                ? '#F8FAFC'
                : alpha(theme.palette.common.white, 0.06),
            borderColor: theme.palette.mode === 'light' ? '#CBD5E1' : '#475569',
          },
          maxWidth: { xs: 210, sm: 290, md: 330 },
        }}
      >
        {/* Company Monogram Badge (28x28 rounded-lg) */}
        <Avatar
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1.75,
            fontSize: '0.75rem',
            fontWeight: 700,
            bgcolor: theme.palette.primary.main,
            color: '#FFFFFF',
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        >
          {getInitials(companyName)}
        </Avatar>

        {/* Workspace Display: If workspaces exist, show Two-Line Stack; If 0 workspaces, show ONLY company name */}
        {hasWorkspace ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, flexGrow: 1 }}>
            <Typography
              component="span"
              sx={{
                fontSize: '10px',
                fontWeight: 600,
                color: theme.palette.mode === 'light' ? '#4338CA' : '#A5B4FC',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {companyName}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: '12px',
                fontWeight: 600,
                color: theme.palette.text.primary,
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: { xs: 130, sm: 190 },
              }}
            >
              {activeWorkspaceName}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden', minWidth: 0, flexGrow: 1 }}>
            <Typography
              component="span"
              sx={{
                fontSize: '13px',
                fontWeight: 700,
                color: theme.palette.text.primary,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: { xs: 140, sm: 210 },
              }}
            >
              {companyName}
            </Typography>
          </Box>
        )}

        {/* Dropdown Chevron */}
        <KeyboardArrowDownRoundedIcon
          sx={{
            fontSize: 16,
            color: theme.palette.text.secondary,
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
            ml: 0.25,
          }}
        />
      </ButtonBase>

      {/* Dropdown Popover Card: Workspace-Only List */}
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 300,
              maxWidth: '92vw',
              borderRadius: 3,
              p: 0,
              overflow: 'hidden',
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              boxShadow:
                theme.palette.mode === 'light'
                  ? '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.08)'
                  : '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
            },
          },
        }}
      >
        {/* Header: Company Name & Workspace Count */}
        <Box
          sx={{
            px: 1.75,
            py: 1.25,
            bgcolor:
              theme.palette.mode === 'light'
                ? '#F8FAFC'
                : alpha(theme.palette.common.white, 0.03),
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ overflow: 'hidden', pr: 1 }}>
            <Typography
              sx={{
                fontSize: '10px',
                fontWeight: 700,
                color: theme.palette.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                lineHeight: 1,
                mb: 0.25,
              }}
            >
              Company
            </Typography>
            <Typography
              sx={{
                fontSize: '12px',
                fontWeight: 700,
                color: theme.palette.text.primary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {companyName}
            </Typography>
          </Box>

          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1.5,
              bgcolor: theme.palette.mode === 'light' ? '#EEF2FF' : alpha('#818CF8', 0.2),
              color: theme.palette.mode === 'light' ? '#3730A3' : '#C7D2FE',
              fontSize: '10px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {visibleWorkspaces.length} {visibleWorkspaces.length === 1 ? 'Workspace' : 'Workspaces'}
          </Box>
        </Box>

        {/* Section Title */}
        <Box sx={{ px: 1.75, pt: 1.25, pb: 0.5 }}>
          <Typography
            sx={{
              fontSize: '11px',
              fontWeight: 600,
              color: theme.palette.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {workspaces.length === 0 ? 'Workspaces' : 'Select Workspace / Branch'}
          </Typography>
        </Box>

        {/* Workspaces List (Only Workspaces / Branches!) */}
        <Box sx={{ maxHeight: 240, overflowY: 'auto', py: 0.5, px: 0.75 }}>
          {visibleWorkspaces.length === 0 ? (
            <Box sx={{ py: 2.5, px: 2, textAlign: 'center' }}>
              <StorefrontRoundedIcon
                sx={{
                  fontSize: 28,
                  color: theme.palette.text.secondary,
                  opacity: 0.4,
                  mb: 0.75,
                }}
              />
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: theme.palette.text.secondary }}>
                No workspaces added yet
              </Typography>
              <Typography sx={{ fontSize: '11px', color: theme.palette.text.secondary, opacity: 0.8, mt: 0.25 }}>
                Create your primary location to begin
              </Typography>
            </Box>
          ) : (
            visibleWorkspaces.map((ws) => {
              const isSelected = ws.id === currentWorkspace?.id;
              const wsRole = getWorkspaceRole(ws);
              return (
                <MenuItem
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws)}
                  sx={{
                    borderRadius: 2,
                    py: 1,
                    px: 1.25,
                    my: 0.25,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.25,
                    backgroundColor: isSelected
                      ? theme.palette.mode === 'light'
                        ? '#EEF2FF'
                        : alpha(theme.palette.primary.main, 0.2)
                      : 'transparent',
                    '&:hover': {
                      backgroundColor: isSelected
                        ? theme.palette.mode === 'light'
                          ? '#E0E7FF'
                          : alpha(theme.palette.primary.main, 0.28)
                        : theme.palette.mode === 'light'
                        ? '#F8FAFC'
                        : alpha(theme.palette.common.white, 0.05),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flexGrow: 1 }}>
                    <StorefrontRoundedIcon
                      sx={{
                        fontSize: 16,
                        color: isSelected
                          ? theme.palette.primary.main
                          : theme.palette.text.secondary,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography
                          sx={{
                            fontSize: '12px',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected
                              ? theme.palette.mode === 'light'
                                ? '#3730A3'
                                : '#C7D2FE'
                              : theme.palette.text.primary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {ws.name}
                        </Typography>
                        <SwitcherRoleBadge role={wsRole} isDark={isDark} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '10px',
                          color: theme.palette.text.secondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ws.city && ws.state ? `${ws.city}, ${ws.state}` : ws.address || 'Branch Office'}
                        {ws.employeeCount ? ` • ${ws.employeeCount} Staff` : ''}
                      </Typography>
                    </Box>
                  </Box>

                  {isSelected && (
                    <CheckRoundedIcon
                      sx={{
                        fontSize: 16,
                        color: theme.palette.primary.main,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </MenuItem>
              );
            })
          )}
        </Box>

        <Divider />

        {/* Footer: Manage or Add Workspaces -> Navigates to /workspace/select */}
        <Box sx={{ p: 0.75, bgcolor: theme.palette.mode === 'light' ? '#F8FAFC' : alpha(theme.palette.common.white, 0.02) }}>
          <MenuItem
            onClick={handleManageWorkspaces}
            sx={{
              borderRadius: 2,
              py: 0.85,
              px: 1.25,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: theme.palette.primary.main,
              fontWeight: 600,
              fontSize: '12px',
              '&:hover': {
                backgroundColor:
                  theme.palette.mode === 'light'
                    ? '#EEF2FF'
                    : alpha(theme.palette.primary.main, 0.16),
              },
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'inherit' }}>
              {workspaces.length === 0 ? 'Create Primary Workspace' : 'Manage or Add Workspaces'}
            </Typography>
          </MenuItem>
        </Box>
      </Menu>

      {/* Toast Feedback */}
      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={3000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToastMessage(null)}
          severity="info"
          variant="filled"
          sx={{
            borderRadius: 2,
            fontWeight: 600,
            fontSize: '0.82rem',
            bgcolor: '#0F172A',
            color: '#FFFFFF',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default WorkspaceSwitcher;
