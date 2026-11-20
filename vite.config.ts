import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** changeOrigin rewrites Host, so the browser's host goes to the API as X-Milo-Host —
    what the CloudFront function does in production. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const passHost = (proxy: any) =>
  proxy.on("proxyReq", (req: any, incoming: any) => req.setHeader("x-milo-host", incoming.headers.host ?? ""));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Google sign-in allows only http://localhost:5173. When it is taken, fail
    // loudly instead of quietly moving to 5174, where sign-in is blocked.
    strictPort: true,
    // *.localhost is an agency's console locally (tst.localhost:5173), like <agency>.milogroups.com.
    allowedHosts: [".localhost"],
    proxy: {
      "/agent": { target: process.env.MILO_API_URL ?? "http://localhost:8001", changeOrigin: true, configure: passHost },
      "/auth": { target: process.env.MILO_API_URL ?? "http://localhost:8001", changeOrigin: true, configure: passHost },
      "/health": { target: process.env.MILO_API_URL ?? "http://localhost:8001", changeOrigin: true },
    },
  },
});
