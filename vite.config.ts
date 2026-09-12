import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/agent": { target: process.env.MILO_API_URL ?? "http://localhost:8000", changeOrigin: true },
      "/auth": { target: process.env.MILO_API_URL ?? "http://localhost:8000", changeOrigin: true },
      "/health": { target: process.env.MILO_API_URL ?? "http://localhost:8000", changeOrigin: true },
    },
  },
});
