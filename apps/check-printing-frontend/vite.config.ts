import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// In development both APIs are reached through this server, so the browser sees one
// origin: the httpOnly login cookies (path /api) are sent to both, and no CORS is needed.
//   /api/v1/auth/*  → platform-api (sign in, sessions, password reset)
//   /api/v1/*       → check-printing-backend (workspaces, checks, printers, ...)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/v1/auth": {
        target: process.env.PLATFORM_API_URL ?? "http://localhost:3001",
        changeOrigin: true,
      },
      "/api/v1": {
        target: process.env.CHECK_API_URL ?? "http://localhost:3005",
        changeOrigin: true,
      },
    },
  },
});
