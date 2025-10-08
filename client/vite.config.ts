import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "Practice",
        short_name: "Practice",
        description: "一款紀錄習慣、目標與日誌的 PWA。",
        theme_color: "#1f2937",
        background_color: "#f9fafb",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "pwa-maskable.png",
            sizes: "1024x1024",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    port: 5173
  }
});

