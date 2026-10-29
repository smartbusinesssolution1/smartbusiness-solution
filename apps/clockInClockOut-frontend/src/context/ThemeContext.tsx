import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';

interface ThemeContextType {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('checkpoint_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('checkpoint_theme', mode);
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(() => {
    const isLight = mode === 'light';
    return createTheme({
      palette: {
        mode,
        primary: {
          main: isLight ? '#4f46e5' : '#818cf8', // Indigo
          light: isLight ? '#e0e7ff' : '#312e81',
          dark: isLight ? '#3730a3' : '#c7d2fe',
        },
        secondary: {
          main: isLight ? '#0d9488' : '#2dd4bf', // Teal
        },
        background: {
          default: isLight ? '#f8fafc' : '#090d16',
          paper: isLight ? '#ffffff' : '#111827',
        },
        text: {
          primary: isLight ? '#0c1427' : '#f8fafc',
          secondary: isLight ? '#5c6880' : '#94a3b8',
        },
        divider: isLight ? '#e3e8f1' : '#1e293b',
        statusPresent: {
          main: '#10b981', // Emerald
          bg: isLight ? '#ecfdf5' : '#064e3b',
        },
        statusLate: {
          main: '#f59e0b', // Amber
          bg: isLight ? '#fffbeb' : '#78350f',
        },
        statusAbsent: {
          main: '#ef4444', // Red
          bg: isLight ? '#fef2f2' : '#7f1d1d',
        },
        statusAutoClosed: {
          main: '#6366f1', // Indigo/Purple
          bg: isLight ? '#f5f3ff' : '#312e81',
        },
      } as any,
      typography: {
        fontFamily: '"Geist Variable", "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica", "Arial", sans-serif',
        h4: {
          fontWeight: 700,
          letterSpacing: '-0.025em',
        },
        h5: {
          fontWeight: 700,
          letterSpacing: '-0.02em',
        },
        h6: {
          fontWeight: 600,
          letterSpacing: '-0.015em',
        },
        subtitle1: {
          fontWeight: 500,
        },
        button: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: ({ ownerState }) => ({
              borderRadius: 8,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none',
              },
              ...(ownerState?.variant === 'contained' && ownerState?.color === 'primary' && {
                background: isLight 
                  ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                  : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                '&.Mui-disabled': {
                  background: isLight ? '#E2E8F0 !important' : '#334155 !important',
                  color: `${isLight ? '#94A3B8' : '#64748B'} !important`,
                },
              }),
            }),
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              boxShadow: isLight 
                ? '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
                : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              border: `1px solid ${isLight ? '#e3e8f1' : '#1e293b'}`,
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: {
              fontWeight: 600,
              backgroundColor: isLight ? '#f1f5f9' : '#1e293b',
              color: isLight ? '#5c6880' : '#94a3b8',
            },
          },
        },
      },
    });
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
