import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Checkbox,
  IconButton,
  InputAdornment,
  Snackbar,
} from '@mui/material';
import {
  ShieldOutlined as ShieldIcon,
  ArrowForward as ArrowForwardIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

// Zod validation schema
const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid business email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await login(data.email, data.password);
      if (user) {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Top Navbar Header matching remix-smartbusinesssolutions */}
      <Box
        component="header"
        sx={{
          px: { xs: 2, sm: 4, md: 6 },
          py: { xs: 1.5, sm: 2 },
          borderBottom: '1px solid #E2E8F0',
          bgcolor: '#FFFFFF',
          width: '100%',
        }}
      >
        <Box
          sx={{
            maxWidth: 1280,
            mx: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: { xs: 1, sm: 2 },
            width: '100%',
          }}
        >
          {/* Brand Logo & Product Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, sm: 1.5 } }}>
            <Box
              sx={{
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                borderRadius: '12px',
                bgcolor: '#EFF6FF',
                border: '1px solid #DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                overflow: 'hidden',
                transition: 'transform 0.2s ease',
                '&:hover': { transform: 'scale(1.05)' },
              }}
            >
              <Box
                component="img"
                src="/auth-icon.png"
                alt="SmartBusiness"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: { xs: 0.75, sm: 1 } }}>
              <Typography
                sx={{
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: { xs: '0.92rem', sm: '1rem' },
                  fontWeight: 800,
                  color: '#0F172A',
                  letterSpacing: '-0.025em',
                }}
              >
                SmartBusiness
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#2563EB',
                  bgcolor: '#EFF6FF',
                  px: 1.25,
                  py: 0.35,
                  borderRadius: '9999px',
                  border: '1px solid #BFDBFE',
                  display: { xs: 'none', sm: 'inline-block' },
                }}
              >
                Clock-In Clock-Out SaaS
              </Typography>
            </Box>
          </Box>

          {/* Right Header Navigation */}
          <Typography
            sx={{
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: { xs: '0.75rem', sm: '0.78rem' },
              color: '#64748B',
              fontWeight: 500,
            }}
          >
            Need a workspace?{' '}
            <Typography
              component="span"
              onClick={() => navigate('/create-workspace')}
              sx={{
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: { xs: '0.75rem', sm: '0.78rem' },
                color: '#2563EB',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'color 0.15s ease',
                '&:hover': {
                  color: '#1D4ED8',
                  textDecoration: 'underline',
                },
              }}
            >
              Create Workspace
            </Typography>
          </Typography>
        </Box>
      </Box>

      {/* Main Login Card Container */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4, md: 6 },
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Card
          className="auth-card-enter"
          sx={{
            width: '100%',
            maxWidth: 460,
            borderRadius: { xs: '20px', sm: '24px' },
            bgcolor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
            transition: 'box-shadow 0.3s ease',
            '&:hover': {
              boxShadow: '0 25px 35px -5px rgba(0, 0, 0, 0.07), 0 10px 15px -6px rgba(0, 0, 0, 0.04)',
            },
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, sm: 4, md: 4.5 }, '&:last-child': { pb: { xs: 2.5, sm: 4, md: 4.5 } } }}>
            {/* Header Row: App Icon & Security Pill */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1.5,
                mb: { xs: 2.5, sm: 3 },
              }}
            >
              {/* App Icon in Rounded Box with hover scale */}
              <Box
                sx={{
                  width: { xs: 46, sm: 54 },
                  height: { xs: 46, sm: 54 },
                  borderRadius: { xs: '14px', sm: '16px' },
                  bgcolor: '#EFF6FF',
                  border: '1px solid #DBEAFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 2px 5px rgba(37, 99, 235, 0.08)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  '&:hover': {
                    transform: 'scale(1.06)',
                  },
                }}
              >
                <Box
                  component="img"
                  src="/auth-icon.png"
                  alt="Clock In Clock Out"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </Box>

              {/* Security Pill Badge with subtle glow pulse */}
              <Box
                className="security-badge-pulse"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: { xs: 1.25, sm: 1.5 },
                  py: { xs: 0.45, sm: 0.6 },
                  borderRadius: '9999px',
                  bgcolor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#DCFCE7',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <ShieldIcon sx={{ fontSize: { xs: 15, sm: 16 }, color: '#16A34A' }} />
                <Typography
                  sx={{
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: { xs: '0.72rem', sm: '0.78rem' },
                    fontWeight: 600,
                    color: '#15803D',
                    letterSpacing: '0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Bank-Grade 256-bit
                </Typography>
              </Box>
            </Box>

            {/* Title & Subtitle */}
            <Typography
              variant="h5"
              sx={{
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 800,
                fontSize: { xs: '1.35rem', sm: '1.5rem', md: '1.65rem' },
                color: '#0F172A',
                letterSpacing: '-0.025em',
                lineHeight: 1.25,
                mb: 1,
              }}
            >
              Sign In to Clock-In Clock-Out
            </Typography>

            <Typography
              sx={{
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: { xs: '0.82rem', sm: '0.875rem' },
                color: '#64748B',
                lineHeight: 1.5,
                mb: { xs: 2.5, sm: 3 },
              }}
            >
              Access your shift rosters, attendance ledger, print reports & geofence settings.
            </Typography>

            {/* Error Alert */}
            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2.5,
                  borderRadius: '12px',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  animation: 'authCardEntrance 0.3s ease-out forwards',
                }}
              >
                {error}
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Work Email Field */}
              <Typography
                sx={{
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1E293B',
                  mb: 0.75,
                }}
              >
                Work Email
              </Typography>
              <TextField
                fullWidth
                placeholder="maria@greenacres.com"
                variant="outlined"
                error={!!errors.email}
                helperText={errors.email?.message}
                disabled={isSubmitting}
                {...register('email')}
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    bgcolor: '#FFFFFF',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    transition: 'all 0.2s ease-in-out',
                    '& fieldset': {
                      borderColor: '#E2E8F0',
                      transition: 'border-color 0.2s ease-in-out',
                    },
                    '&:hover fieldset': {
                      borderColor: '#CBD5E1',
                    },
                    '&.Mui-focused': {
                      boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.12)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#2563EB',
                    },
                  },
                }}
              />

              {/* Password Field Header Row */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 0.75,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#1E293B',
                  }}
                >
                  Password
                </Typography>
                <Typography
                  component="span"
                  onClick={() =>
                    setInfoNotice('Please contact your administrator to reset your corporate password.')
                  }
                  sx={{
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: '#2563EB',
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                    '&:hover': {
                      color: '#1D4ED8',
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Forgot password?
                </Typography>
              </Box>

              {/* Password Field */}
              <TextField
                fullWidth
                placeholder="••••••••••••"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                error={!!errors.password}
                helperText={errors.password?.message}
                disabled={isSubmitting}
                {...register('password')}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={isSubmitting}
                          size="small"
                          sx={{
                            color: '#94A3B8',
                            transition: 'color 0.2s ease',
                            '&:hover': { color: '#475569' },
                          }}
                        >
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    bgcolor: '#FFFFFF',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    transition: 'all 0.2s ease-in-out',
                    '& fieldset': {
                      borderColor: '#E2E8F0',
                      transition: 'border-color 0.2s ease-in-out',
                    },
                    '&:hover fieldset': {
                      borderColor: '#CBD5E1',
                    },
                    '&.Mui-focused': {
                      boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.12)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#2563EB',
                    },
                  },
                }}
              />

              {/* Remember Me Checkbox with micro-interaction */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 2.5,
                }}
              >
                <Checkbox
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  size="small"
                  sx={{
                    p: 0.5,
                    mr: 1,
                    color: '#CBD5E1',
                    transition: 'transform 0.15s ease',
                    '&:hover': {
                      transform: 'scale(1.08)',
                    },
                    '&.Mui-checked': {
                      color: '#2563EB',
                    },
                  }}
                />
                <Typography
                  onClick={() => setRememberDevice(!rememberDevice)}
                  sx={{
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '0.84rem',
                    color: '#475569',
                    fontWeight: 500,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'color 0.15s ease',
                    '&:hover': { color: '#1E293B' },
                  }}
                >
                  Remember this device for 30 days
                </Typography>
              </Box>

              {/* Submit Button with smooth lift and arrow glide */}
              <Button
                fullWidth
                size="large"
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                sx={{
                  py: 1.5,
                  borderRadius: '12px',
                  bgcolor: '#2563EB',
                  color: '#FFFFFF',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  '&:hover': {
                    bgcolor: '#1D4ED8',
                    transform: 'translateY(-1.5px)',
                    boxShadow: '0 8px 20px 0 rgba(37, 99, 235, 0.38)',
                    '& .button-arrow-icon': {
                      transform: 'translateX(4px)',
                    },
                  },
                  '&:active': {
                    transform: 'translateY(0.5px) scale(0.99)',
                  },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  '& .button-arrow-icon': {
                    transition: 'transform 0.2s ease',
                  },
                }}
              >
                {isSubmitting ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  <>
                    Sign In to Dashboard
                    <ArrowForwardIcon className="button-arrow-icon" sx={{ fontSize: 18 }} />
                  </>
                )}
              </Button>
            </form>

            {/* Footer Notice & Registration */}
            <Box
              sx={{
                textAlign: 'center',
                mt: { xs: 2.5, sm: 3.5 },
                pt: { xs: 2, sm: 2.5 },
                borderTop: '1px solid #F1F5F9',
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#64748B',
                  fontSize: { xs: '0.72rem', sm: '0.75rem' },
                }}
              >
                Need a new workspace?{' '}
                <Typography
                  component="span"
                  onClick={() => navigate('/create-workspace')}
                  sx={{
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: '#2563EB',
                    fontSize: { xs: '0.72rem', sm: '0.75rem' },
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      color: '#1D4ED8',
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Create Workspace
                </Typography>
              </Typography>

              <Typography
                sx={{
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  color: '#94A3B8',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  mt: 1.5,
                  lineHeight: 1.4,
                }}
              >
                📱 Staff Notice: Employees must use the SmartBusiness Mobile App to clock in/out.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Bottom Footer Bar matching remix-smartbusinesssolutions */}
      <Box
        component="footer"
        sx={{
          py: { xs: 1.5, sm: 2 },
          px: { xs: 2, sm: 3 },
          textAlign: 'center',
          borderTop: '1px solid #E2E8F0',
          bgcolor: '#FFFFFF',
        }}
      >
        <Typography
          sx={{
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: { xs: '0.7rem', sm: '0.75rem' },
            color: '#94A3B8',
            fontWeight: 500,
          }}
        >
          SmartBusiness Clock-In Clock-Out SaaS · Production Suite
        </Typography>
      </Box>

      {/* Info Snackbar for Forgot Password */}
      <Snackbar
        open={!!infoNotice}
        autoHideDuration={4000}
        onClose={() => setInfoNotice(null)}
        message={infoNotice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default LoginPage;
