import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Snackbar, Alert, AlertColor, Slide, SlideProps, Box, Typography } from '@mui/material';

export interface NotificationState {
  open: boolean;
  message: string;
  severity: AlertColor;
  title?: string;
  duration?: number;
}

export interface NotificationContextType {
  showNotification: (message: string, severity?: AlertColor, duration?: number, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  closeNotification: () => void;
}

// Global callback for axios interceptors and non-React utility calls
type NotificationCallback = (message: string, severity?: AlertColor, duration?: number, title?: string) => void;
let globalNotifier: NotificationCallback | null = null;

export const notify = (
  message: string,
  severity: AlertColor = 'error',
  duration = 5000,
  title?: string
) => {
  if (globalNotifier) {
    globalNotifier(message, severity, duration, title);
  } else {
    console.warn(`[Notification] (${severity}): ${message}`);
  }
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

let lastShown = { msg: '', time: 0 };

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'error',
    duration: 5000,
  });

  const showNotification = useCallback(
    (message: string, severity: AlertColor = 'error', duration = 5000, title?: string) => {
      // Don't display empty messages or generic canceled errors
      if (!message || message.trim() === '' || message.toLowerCase().includes('canceled')) {
        return;
      }

      // Suppress immediate duplicate notifications within 1.5 seconds
      const now = Date.now();
      if (now - lastShown.time < 1500 && lastShown.msg === message) {
        return;
      }
      lastShown = { msg: message, time: now };

      setNotification({
        open: true,
        message,
        severity,
        duration,
        title,
      });
    },
    []
  );

  const showError = useCallback(
    (message: string, title?: string) => showNotification(message, 'error', 6000, title),
    [showNotification]
  );

  const showSuccess = useCallback(
    (message: string, title?: string) => showNotification(message, 'success', 4000, title),
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string, title?: string) => showNotification(message, 'warning', 5000, title),
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string, title?: string) => showNotification(message, 'info', 4000, title),
    [showNotification]
  );

  const closeNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  // Register global listener for non-component callers (like axios interceptors)
  useEffect(() => {
    globalNotifier = (msg, sev = 'error', dur = 5000, title) => {
      showNotification(msg, sev, dur, title);
    };
    return () => {
      globalNotifier = null;
    };
  }, [showNotification]);

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        showError,
        showSuccess,
        showWarning,
        showInfo,
        closeNotification,
      }}
    >
      {children}
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.duration}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          closeNotification();
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        slots={{ transition: SlideTransition }}
        sx={{
          mt: 2,
          mr: 1,
          zIndex: 9999,
          maxWidth: { xs: '90vw', sm: 460 },
        }}
      >
        <Alert
          onClose={closeNotification}
          severity={notification.severity}
          variant="filled"
          elevation={6}
          sx={{
            width: '100%',
            borderRadius: 2.5,
            fontWeight: 500,
            fontSize: '0.875rem',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            '& .MuiAlert-icon': {
              fontSize: 22,
            },
          }}
        >
          {notification.title && (
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
              {notification.title}
            </Typography>
          )}
          <Box sx={{ wordBreak: 'break-word', lineHeight: 1.45 }}>{notification.message}</Box>
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
