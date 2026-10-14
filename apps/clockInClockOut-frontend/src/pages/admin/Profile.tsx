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
  Paper,
  Snackbar,
  Alert,
  Chip,
  useTheme,
  CircularProgress,
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
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { getSessionUser, setSessionUser, getUsers, saveUsers } from '../../services/mockDb';

const profileSchema = z.object({
  phone: z.string().trim().min(5, 'Phone number must be at least 5 digits'),
  avatarUrl: z.string().trim().url('Please enter a valid image URL').or(z.string().length(0)),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const AdminProfile: React.FC = () => {
  const { user, updateCurrentUserState } = useAuth();
  const theme = useTheme();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      phone: user?.phone || '',
      avatarUrl: user?.avatarUrl || '',
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    setIsUpdating(true);
    
    // Simulate API delay
    setTimeout(() => {
      try {
        const dbUsers = getUsers();
        const index = dbUsers.findIndex((u) => u.id === user.id);
        
        if (index !== -1) {
          const updated = {
            ...dbUsers[index],
            phone: data.phone,
            avatarUrl: data.avatarUrl || dbUsers[index].avatarUrl,
          };
          dbUsers[index] = updated;
          saveUsers(dbUsers);
          setSessionUser(updated);
          updateCurrentUserState(updated);
          setSnackbarMsg('Administrator details updated successfully!');
          setSnackbarOpen(true);
        }
      } catch (err) {
        console.error(err);
        setSnackbarMsg('Failed to update admin profile.');
        setSnackbarOpen(true);
      } finally {
        setIsUpdating(false);
      }
    }, 600);
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
                <Avatar
                  src={user?.avatarUrl}
                  alt={user?.name}
                  sx={{ width: 100, height: 100, mb: 2, border: `3px solid ${theme.palette.secondary.main}` }}
                />
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
                Administrator Contact Channels
              </Typography>

              <form onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      value={user?.name || ''}
                      disabled
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
                      label="Official Email Address"
                      value={user?.email || ''}
                      disabled
                      slotProps={{
                        input: {
                          startAdornment: <EmailIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                        },
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Admin Contact Phone"
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

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Avatar Image URL"
                      placeholder="https://images.unsplash.com/photo-..."
                      error={!!errors.avatarUrl}
                      helperText={errors.avatarUrl?.message}
                      {...register('avatarUrl')}
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
        <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%', borderRadius: 2 }}>
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminProfile;
