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
import { useAuth } from '../context/AuthContext';
import { Workspace } from '../types';

export const WorkspaceSwitcher: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant, workspaces, currentWorkspace, switchWorkspace, isSuperAdmin } = useAuth();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Workspace switcher is strictly restricted to Super Admin / Organization Owner
  if (!isSuperAdmin) {
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
  const companyName = currentTenant?.name || 'Green Acres Landscaping LLC';
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

        {/* Two-Line Stack: Tenant / Company Name (Top) + Active Workspace (Bottom) */}
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
            {currentWorkspace?.name || 'Main Headquarters (HQ)'}
          </Typography>
        </Box>

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
            {workspaces.length} Workspaces
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
            Select Workspace / Branch
          </Typography>
        </Box>

        {/* Workspaces List (Only Workspaces / Branches!) */}
        <Box sx={{ maxHeight: 240, overflowY: 'auto', py: 0.5, px: 0.75 }}>
          {workspaces.map((ws) => {
            const isSelected = ws.id === currentWorkspace?.id;
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
          })}
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
              Manage or Add Workspaces
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
