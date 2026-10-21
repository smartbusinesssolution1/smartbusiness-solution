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
  InputAdornment,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Apartment as ApartmentIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';

// Zod validation schema (Password field removed per specification)
const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Company / Organization Name is required'),
  fullName: z.string().trim().min(2, 'Your Full Name is required'),
  email: z.string().trim().email('Please enter a valid work email address'),
  defaultPolicy: z.string().min(1, 'Please select a default policy'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const policyOptions = [
  'Standard Fixed Shift (9:00 AM - 5:00 PM)',
  'Flexible Shift (8 Hours / Day)',
  'Field & Remote GPS Geofenced',
  'Rotational 24/7 Shifts',
];

export const RegisterPage: React.FC = () => {
  const { register: registerWorkspace } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: '',
      fullName: '',
      email: '',
      defaultPolicy: policyOptions[0],
    },
  });

  const selectedPolicy = watch('defaultPolicy');

  const onSubmit = async (data: RegisterFormValues) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await registerWorkspace(
        data.companyName,
        data.fullName,
        data.email,
        data.defaultPolicy
      );
      if (user) {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace. Please verify your details.');
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
            Already have an account?{' '}
            <Typography
              component="span"
              onClick={() => navigate('/login')}
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
              Sign In
            </Typography>
          </Typography>
        </Box>
      </Box>

      {/* Main Form Container */}
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
            maxWidth: { xs: '100%', sm: 580 },
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
            {/* Header Row: App Icon & Badge */}
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

              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: { xs: 1.25, sm: 1.5 },
                  py: { xs: 0.45, sm: 0.6 },
                  borderRadius: '9999px',
                  bgcolor: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: '0.72rem', sm: '0.78rem' },
                    fontWeight: 600,
                    color: '#15803D',
                    letterSpacing: '0.01em',
                  }}
                >
                  Enterprise Registration
                </Typography>
              </Box>
            </Box>

            {/* Header Title & Subtitle */}
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
              Create your Clock-In Clock-Out Workspace
            </Typography>

            <Typography
              sx={{
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: { xs: '0.82rem', sm: '0.875rem' },
                color: '#64748B',
                lineHeight: 1.5,
                mb: { xs: 2, sm: 3 },
              }}
            >
              Set up your attendance tracking, geofence rules, and staff rosters in minutes.
            </Typography>

            {/* Top Divider */}
            <Divider sx={{ mb: { xs: 2.5, sm: 3.5 }, borderColor: '#F1F5F9' }} />

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

            {/* Registration Form */}
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Field 1: Company / Organization Name */}
              <Typography
                sx={{
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1E293B',
                  mb: 0.75,
                }}
              >
                Company / Organization Name
              </Typography>
              <TextField
                fullWidth
                placeholder="e.g. Acme Financial Group LLC"
                variant="outlined"
                error={!!errors.companyName}
                helperText={errors.companyName?.message}
                disabled={isSubmitting}
                {...register('companyName')}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <ApartmentIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                  },
                }}
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

              {/* Field 2 & 3: Two Columns Row (Full Name & Work Email) */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                  mb: 2.5,
                }}
              >
                {/* Left Column: Your Full Name */}
                <Box>
                  <Typography
                    sx={{
                      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#1E293B',
                      mb: 0.75,
                    }}
                  >
                    Your Full Name
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="e.g. Maria Davis"
                    variant="outlined"
                    error={!!errors.fullName}
                    helperText={errors.fullName?.message}
                    disabled={isSubmitting}
                    {...register('fullName')}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{
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
                </Box>

                {/* Right Column: Work Email */}
                <Box>
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
                    placeholder="maria@acme.com"
                    variant="outlined"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    disabled={isSubmitting}
                    {...register('email')}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{
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
                </Box>
              </Box>

              {/* Note: Password field removed per specification */}

              {/* Field 4: Dropdown Selection */}
              <Typography
                sx={{
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1E293B',
                  mb: 0.75,
                }}
              >
                Default Attendance Policy
              </Typography>
              <TextField
                select
                fullWidth
                value={selectedPolicy}
                onChange={(e) => setValue('defaultPolicy', e.target.value)}
                disabled={isSubmitting}
                sx={{
                  mb: 3.5,
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
              >
                {policyOptions.map((opt) => (
                  <MenuItem
                    key={opt}
                    value={opt}
                    sx={{
                      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '0.9rem',
                    }}
                  >
                    {opt}
                  </MenuItem>
                ))}
              </TextField>

              {/* Submit Button with smooth hover lift and arrow glide */}
              <Button
                fullWidth
                size="large"
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                sx={{
                  py: { xs: 1.35, sm: 1.5 },
                  px: 2,
                  borderRadius: '12px',
                  bgcolor: '#2563EB',
                  color: '#FFFFFF',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: { xs: '0.88rem', sm: '0.95rem' },
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
                    flexShrink: 0,
                  },
                }}
              >
                {isSubmitting ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  <>
                    <Box component="span" sx={{ textAlign: 'center', lineHeight: 1.3 }}>
                      Create Workspace & Launch Clock-In Clock-Out
                    </Box>
                    <ArrowForwardIcon className="button-arrow-icon" sx={{ fontSize: 18 }} />
                  </>
                )}
              </Button>
            </form>

            {/* Footer Back to Login */}
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
                Already have an existing workspace?{' '}
                <Typography
                  component="span"
                  onClick={() => navigate('/login')}
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
                  Sign In to Dashboard
                </Typography>
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
    </Box>
  );
};

export default RegisterPage;
