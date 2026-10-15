import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
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
} from '@mui/material';
import {
  Person as PersonIcon,
  Badge as BadgeIcon,
  Phone as PhoneIcon,
  Work as WorkIcon,
  CalendarToday as DateIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { setSessionUser, getUsers, saveUsers } from '../../services/mockDb';
import { clockInApi, platformAuthApi } from '../../services/apiClient';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().trim().min(5, 'Phone number must be at least 5 digits'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const EmployeeProfile: React.FC = () => {
  const { user, updateCurrentUserState } = useAuth();
  const theme = useTheme();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [isUpdating, setIsUpdating] = useState(false);

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
    }
  }, [user, reset]);

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
        await platformAuthApi.patch('/api/v1/auth/profile', {
          fullName: data.name,
        }).catch(() => {});
      }

      // 2. Update local session & mockDb
      const dbUsers = getUsers();
      const index = dbUsers.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
      
      const updated: User = {
        ...(index !== -1 ? dbUsers[index] : user),
        ...user,
        name: data.name,
        phone: data.phone,
        // Employees cannot update their profile picture
        avatarUrl: index !== -1 ? dbUsers[index].avatarUrl : user.avatarUrl,
      };

      if (index !== -1) {
        dbUsers[index] = updated;
      } else {
        dbUsers.push(updated);
      }

      saveUsers(dbUsers);
      setSessionUser(updated);
      updateCurrentUserState(updated);
      setSnackbarSeverity('success');
      setSnackbarMsg('Personal profile details updated and saved successfully!');
      setSnackbarOpen(true);
    } catch (err: any) {
      console.error('Failed to update employee profile:', err);
      setSnackbarSeverity('error');
      setSnackbarMsg(err?.response?.data?.error?.message || err?.message || 'Failed to update profile.');
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
          My Profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review your official employment record and update your contact info.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Side: Photo & Corporate Metadata */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: 3, textAlign: 'center', p: 1 }}>
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 1 }}>
                <Avatar
                  src={user?.avatarUrl}
                  alt={user?.name}
                  sx={{ width: 100, height: 100, mb: 2, border: `3px solid ${theme.palette.primary.main}` }}
                />
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {user?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 1.5 }}>
                  {user?.designation}
                </Typography>

                <Chip
                  label={user?.status === 'active' ? 'Active Employee' : 'Inactive'}
                  color={user?.status === 'active' ? 'success' : 'default'}
                  size="small"
                  sx={{ px: 1, fontWeight: 700 }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <BadgeIcon color="action" fontSize="small" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      EMPLOYEE ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {user?.employeeId}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <WorkIcon color="action" fontSize="small" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      DEPARTMENT / BUSINESS UNIT
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {user?.department}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <DateIcon color="action" fontSize="small" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      DATE JOINED
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
                Personal Contact & Profile Settings
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
                      color="primary"
                      disabled={isUpdating}
                      startIcon={isUpdating ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                      sx={{ px: 4, py: 1.25 }}
                    >
                      {isUpdating ? 'Saving Changes...' : 'Save Profile Details'}
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

export default EmployeeProfile;
