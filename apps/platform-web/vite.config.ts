import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Sign-up and sign-in reach platform-api through this server, so the browser sees one
      // origin and the httpOnly login cookies are stored for it (production: the portal's
      // nginx does the same). The cookies belong to the host, not the port, so locally they
      // are also sent to Check Printing on localhost:5173: one sign-in for both.
      proxy: {
        '/api/v1/auth': {
          target: process.env.PLATFORM_API_URL ?? 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
