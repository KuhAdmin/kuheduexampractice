import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker is only generated for `vite build`; `npm run dev`
      // stays completely unaffected (avoids the well-known dev-mode
      // stale-cache footgun with this plugin).
      devOptions: { enabled: false },
      registerType: "autoUpdate",
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/maskable-icon-512.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        name: "KUHEDU MASTER",
        short_name: "KUHEDU",
        description: "Practice chapters, assessments, and flashcards for CBSE/board exam prep.",
        display: "standalone",
        start_url: "/",
        scope: "/",
        theme_color: "#2f9e44",
        background_color: "#eef8ea",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/maskable-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5005",
    },
  },
});
