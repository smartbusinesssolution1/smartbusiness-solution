import React from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import {
  Box,
  Typography,
  Chip,
  Paper,
  useTheme,
  FormHelperText,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';

export interface ShiftTimePickerProps {
  label: string;
  value?: string; // HH:mm format e.g. "09:00"
  onChange: (timeStr: string) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
}

export const ShiftTimePicker: React.FC<ShiftTimePickerProps> = ({
  label,
  value = '09:00',
  onChange,
  error = false,
  helperText,
  disabled = false,
}) => {
  const theme = useTheme();

  // Convert HH:mm string to dayjs object
  const dayjsValue: Dayjs | null = React.useMemo(() => {
    if (!value || !value.includes(':')) return null;
    const [h, m] = value.split(':');
    return dayjs().hour(Number(h)).minute(Number(m)).second(0);
  }, [value]);

  const handleTimeChange = (newValue: Dayjs | null) => {
    if (newValue && newValue.isValid()) {
      onChange(newValue.format('HH:mm'));
    }
  };

  const formatted12h = React.useMemo(() => {
    if (!dayjsValue || !dayjsValue.isValid()) return value;
    return dayjsValue.format('hh:mm A');
  }, [dayjsValue, value]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%' }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2.5,
            border: '1.5px solid',
            borderColor: error ? 'error.main' : 'divider',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              borderColor: error ? 'error.main' : 'primary.main',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {label}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={formatted12h}
              color="primary"
              variant="filled"
              sx={{ fontWeight: 700, fontSize: '0.78rem', height: 24, px: 0.5 }}
            />
          </Box>

          {/* Interactive Material UI TimePicker */}
          <TimePicker
            value={dayjsValue}
            onChange={handleTimeChange}
            disabled={disabled}
            ampm
            views={['hours', 'minutes']}
            slotProps={{
              textField: {
                fullWidth: true,
                size: 'small',
                error: error,
                sx: {
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    fontWeight: 600,
                  },
                },
              },
              popper: {
                sx: {
                  zIndex: 1300,
                  '& .MuiPaper-root': {
                    borderRadius: '16px !important',
                    overflow: 'hidden !important',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'dark'
                        ? '0 16px 40px -4px rgba(0, 0, 0, 0.7)'
                        : '0 16px 40px -4px rgba(0, 0, 0, 0.16)',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  },
                  // Fix the digital clock container width and padding
                  '& .MuiMultiSectionDigitalClock-root': {
                    width: '270px !important',
                    maxHeight: '230px !important',
                    pt: '8px !important',
                    pb: '8px !important',
                  },
                  // Fix each column section so it's not cramped and has thin scrollbars
                  '& .MuiMultiSectionDigitalClockSection-root': {
                    width: '90px !important',
                    minWidth: '88px !important',
                    scrollbarWidth: 'thin',
                    '&:not(:first-of-type)': {
                      borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
                    },
                    '&::-webkit-scrollbar': {
                      width: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)',
                      borderRadius: '4px',
                    },
                    // Style each number item as a rounded pill with margins so it NEVER clips the popper edge
                    '& .MuiMenuItem-root, & .MuiMultiSectionDigitalClockSection-item': {
                      borderRadius: '8px !important',
                      mx: '6px !important',
                      my: '2px !important',
                      py: '6px !important',
                      fontSize: '0.92rem !important',
                      fontWeight: '600 !important',
                      justifyContent: 'center !important',
                      textAlign: 'center !important',
                      transition: 'all 0.15s ease',
                      '&.Mui-selected': {
                        bgcolor: (theme) => `${theme.palette.primary.main} !important`,
                        color: (theme) => `${theme.palette.primary.contrastText} !important`,
                        fontWeight: '700 !important',
                        '&:hover': {
                          bgcolor: (theme) => `${theme.palette.primary.dark} !important`,
                        },
                      },
                      '&:hover': {
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      },
                    },
                  },
                  // Style the action bar at the bottom with a clear top border
                  '& .MuiPickersLayout-actionBar, & .MuiDialogActions-root': {
                    borderTop: (theme) => `1px solid ${theme.palette.divider} !important`,
                    px: 2,
                    py: 1,
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 1,
                    '& .MuiButton-root': {
                      fontWeight: 600,
                      textTransform: 'none',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      px: 2,
                    },
                  },
                },
              },
            }}
          />

          {helperText && (
            <FormHelperText error={error} sx={{ mt: 1, ml: 0.5, fontWeight: 500 }}>
              {helperText}
            </FormHelperText>
          )}
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default ShiftTimePicker;
