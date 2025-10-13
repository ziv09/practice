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
        description: "一個專注習慣與記錄的 PWA。",
        theme_color: "#1f2937",
        background_color: "#f9fafb",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" }
        ]
      },
      // 使用自訂 Service Worker（含 push & message 事件）
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"]
      },
      devOptions: { enabled: false }
    })
  ],
  server: {
    port: 5173
  }
});

