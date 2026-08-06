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
      workbox: {
        // Default 2 MiB limit is too small once the AI Tutor avatar
        // (@spatialwalk/avatarkit, WASM-backed rendering) is in the bundle --
        // raised to cover the main chunk's current size with headroom.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Without this, the SW's default SPA navigateFallback intercepts
        // EVERY top-level navigation -- including /api/auth/google, whose
        // whole job is a server-side 302 redirect to accounts.google.com.
        // The SW serving the cached index.html instead of letting that
        // request reach Passport breaks Google Sign-In in production only
        // (the SW is dev-disabled, see devOptions above) and throws Chrome's
        // "Unsafe attempt to load URL ... Domains, protocols and ports must
        // match" error. API routes must always hit the network untouched.
        navigateFallbackDenylist: [/^\/api\//],
      },
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/maskable-icon-512.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        name: "KUHEDU STUDY BUDDY",
        short_name: "KUHEDU STUDY BUDDY",
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
