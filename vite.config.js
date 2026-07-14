import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "apple-touch-icon.png",
        "favicon.ico",
        "favicon-64.png",
        "pwa-icon.svg",
        "push-handler.js",
        "cursors/*.svg",
      ],
      manifest: {
        id: "/",
        name: "Lili — Mi espacio",
        short_name: "Lili",
        description: "Un espacio privado para organizar tareas, notas y recuerdos.",
        lang: "es-MX",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone"],
        orientation: "any",
        background_color: "#f4eef3",
        theme_color: "#9fe4f5",
        categories: ["productivity", "lifestyle"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        importScripts: ["push-handler.js"],
        navigateFallback: "/index.html",
        skipWaiting: false,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    clearMocks: true,
  },
});
