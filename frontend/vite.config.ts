import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
      manifest: {
        name: "Productivity Dashboard",
        short_name: "ProdDash",
        description: "A gaming-inspired personal productivity dashboard for college and software projects.",
        theme_color: "#0B0E1A",
        background_color: "#0B0E1A",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        // Web Push handlers live in public/push-sw.js, loaded by the
        // generated SW via importScripts (workbox's supported way to add a
        // push listener without leaving generateSW mode). It must stay out
        // of the precache manifest since it's imported directly, not
        // revisioned.
        globIgnores: ["**/push-sw.js"],
        importScripts: ["/push-sw.js"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
