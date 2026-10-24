import React from 'react';
import { Box, Typography } from '@mui/material';

export interface BrandLoaderProps {
  /** If true (default), solid #F8FAFC background; if false, frosted backdrop blur overlay centered on screen */
  fullScreen?: boolean;
  /** Custom descriptive message displayed below the progress bar */
  message?: string;
  /** If true (default), displays a subtle shimmer progress bar at the very top of the window */
  showTopBar?: boolean;
}

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  fullScreen = true,
  message = 'Loading workspace...',
  showTopBar = true,
}) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        bgcolor: fullScreen ? '#F8FAFC' : 'rgba(248, 250, 252, 0.88)',
        backdropFilter: fullScreen ? 'none' : 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        p: 3,
        boxSizing: 'border-box',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Top slim animated gradient shimmer bar */}
      {showTopBar && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #2563EB, #60A5FA, #2563EB)',
            backgroundSize: '200% 100%',
            animation: 'brandTopShimmer 1.8s ease-in-out infinite',
            zIndex: 100000,
            '@keyframes brandTopShimmer': {
              '0%': { backgroundPosition: '200% 0' },
              '100%': { backgroundPosition: '-200% 0' },
            },
          }}
        />
      )}

      {/* Center Brand Icon with Soft Pulse */}
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '18px',
          bgcolor: '#EFF6FF',
          border: '1px solid #DBEAFE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.15)',
          mb: 3,
          animation: 'brandIconPulse 2s ease-in-out infinite',
          '@keyframes brandIconPulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 1 },
            '50%': { transform: 'scale(1.05)', opacity: 0.9 },
          },
        }}
      >
        <Box
          component="img"
          src="/auth-icon.png"
          alt="SmartBusiness"
          sx={{
            width: 36,
            height: 36,
            objectFit: 'contain',
          }}
        />
      </Box>

      {/* Sleek Slim Linear Progress Bar */}
      <Box
        sx={{
          width: 140,
          height: 4,
          borderRadius: '9999px',
          bgcolor: '#E2E8F0',
          overflow: 'hidden',
          position: 'relative',
          mb: 2,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '45%',
            borderRadius: '9999px',
            bgcolor: '#2563EB',
            animation: 'brandSlideProgress 1.4s ease-in-out infinite',
            '@keyframes brandSlideProgress': {
              '0%': { left: '-45%' },
              '50%': { left: '30%', width: '55%' },
              '100%': { left: '100%', width: '45%' },
            },
          }}
        />
      </Box>

      {/* Modern Microcopy */}
      <Typography
        sx={{
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#64748B',
          letterSpacing: '-0.01em',
        }}
      >
        {message}
      </Typography>
    </Box>
  );
};

export default BrandLoader;
