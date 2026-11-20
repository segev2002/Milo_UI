import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Google sign-in allows only http://localhost:5173. When it is taken, fail
    // loudly instead of quietly moving to 5174, where sign-in is blocked.
    strictPort: true,
    proxy: {
      "/agent": { target: process.env.MILO_API_URL ?? "http://localhost:8001", changeOrigin: true },
      "/auth": { target: process.env.MILO_API_URL ?? "http://localhost:8001", changeOrigin: true },
      "/health": { target: process.env.MILO_API_URL ?? "http://localhost:8001", changeOrigin: true },
    },
  },
});
