import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Divider,
  Snackbar,
  Alert,
  Chip,
  useTheme,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Person as PersonIcon,
  Badge as BadgeIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  CalendarToday as DateIcon,
  Save as SaveIcon,
  AdminPanelSettings as AdminIcon,
  PhotoCamera as CameraIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { setSessionUser, getUsers, saveUsers } from '../../services/mockDb';
import { clockInApi, platformAuthApi } from '../../services/apiClient';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().trim().min(5, 'Phone number must be at least 5 digits'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const AdminProfile: React.FC = () => {
  const { user, currentTenant, updateCurrentUserState } = useAuth();
  const theme = useTheme();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [isUpdating, setIsUpdating] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Allow only super admin and admin to update their profile picture
  const canUpdateAvatar =
    user?.role === 'admin' ||
    currentTenant?.role === 'OWNER' ||
    currentTenant?.role === 'ADMIN';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
    },
  });

  // Keep form in sync when user loads or updates
  React.useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
        phone: user.phone || '',
      });
      setAvatarPreview(user.avatarUrl);
    }
  }, [user, reset]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSnackbarMsg('Please upload a valid image file (PNG, JPG, WebP).');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      setSnackbarMsg('Image size should be less than 5MB.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    setIsUpdating(true);
    
    try {
      // 1. Persist Name to central platform-api (PostgreSQL users table)
      try {
        await clockInApi.patch('/api/v1/auth/profile', {
          fullName: data.name,
        });
      } catch (authErr) {
        // Fallback directly to platformAuthApi if proxy didn't catch
        await platformAuthApi.patch('/api/v1/auth/profile', {
          fullName: data.name,
        }).catch(() => {});
      }

      // 2. Persist Profile Picture to Clock-In backend (PostgreSQL employees table) if changed and privileged
      if (canUpdateAvatar && avatarPreview && avatarPreview !== user.avatarUrl) {
        await clockInApi.patch('/api/v1/employees/me', {
          biometricPhotoUrl: avatarPreview,
        }).catch((err) => console.warn('Could not persist avatar to employee record:', err));
      }

      // 3. Update local session & mockDb
      const dbUsers = getUsers();
      const index = dbUsers.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
      
      const updated: User = {
        ...(index !== -1 ? dbUsers[index] : user),
        ...user,
        name: data.name,
        phone: data.phone,
        avatarUrl: canUpdateAvatar && avatarPreview ? avatarPreview : (index !== -1 ? dbUsers[index].avatarUrl : user.avatarUrl),
      };

      if (index !== -1) {
        dbUsers[index] = updated;
      } else {
        dbUsers.push(updated);
      }

      saveUsers(dbUsers);
      setSessionUser(updated);
      updateCurrentUserState(updated);
      if (user?.id && (avatarPreview || updated.avatarUrl)) {
        localStorage.setItem(`avatar_uploaded_${user.id}`, 'true');
      }
      setSnackbarSeverity('success');
      setSnackbarMsg('Administrator details updated and saved successfully!');
      setSnackbarOpen(true);
    } catch (err: any) {
      console.error('Failed to update admin profile:', err);
      setSnackbarSeverity('error');
      setSnackbarMsg(err?.response?.data?.error?.message || err?.message || 'Failed to update admin profile.');
      setSnackbarOpen(true);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Admin Profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review your official administrative credentials and update your contact settings.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Side: Photo & Admin Metadata */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 3, textAlign: 'center', p: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 1 }}>
                <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                  <Avatar
                    src={avatarPreview || user?.avatarUrl}
                    alt={user?.name}
                    sx={{
                      width: 110,
                      height: 110,
                      border: `3px solid ${theme.palette.secondary.main}`,
                      boxShadow: theme.shadows[3],
                    }}
                  />
                  {canUpdateAvatar && (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageFileChange}
                      />
                      <Tooltip title="Upload profile picture">
                        <IconButton
                          onClick={() => fileInputRef.current?.click()}
                          sx={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            bgcolor: theme.palette.secondary.main,
                            color: theme.palette.secondary.contrastText,
                            '&:hover': {
                              bgcolor: theme.palette.secondary.dark,
                            },
                            boxShadow: theme.shadows[2],
                            p: 0.8,
                          }}
                          size="small"
                        >
                          <CameraIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>

                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {user?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1.5 }}>
                  {user?.designation || 'System Owner'}
                </Typography>

                <Chip
                  label="System Admin"
                  color="secondary"
                  size="small"
                  icon={<AdminIcon />}
                  sx={{ px: 1, fontWeight: 700 }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <BadgeIcon color="action" fontSize="small" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      ADMINISTRATOR ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {user?.employeeId}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <EmailIcon color="action" fontSize="small" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      OFFICIAL EMAIL
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        wordBreak: 'break-all',
                      }}
                    >
                      {user?.email || '--'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <WorkIcon color="action" fontSize="small" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      DEPARTMENT
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {user?.department || 'Operations Management'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <DateIcon color="action" fontSize="small" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      DATE ONBOARDED
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {user?.joinedDate ? dayjs(user.joinedDate).format('MMMM DD, YYYY') : '--'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side: Form Details */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                Administrator Profile Settings
              </Typography>

              <form onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      {...register('name')}
                      slotProps={{
                        input: {
                          startAdornment: <PersonIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                        },
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Contact Phone Number"
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                      {...register('phone')}
                      slotProps={{
                        input: {
                          startAdornment: <PhoneIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                        },
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>

                  <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      disabled={isUpdating}
                      startIcon={isUpdating ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                      sx={{ px: 4, py: 1.25 }}
                    >
                      {isUpdating ? 'Saving Admin...' : 'Save Admin Settings'}
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar alerts */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%', borderRadius: 2 }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminProfile;
