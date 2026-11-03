import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 3004,
    strictPort: true,
    proxy: {
      "/api/v1/super-admin": {
        target: process.env.PLATFORM_API_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
