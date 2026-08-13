import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Le back-office appelle l'API en **même origine**, sous `/api`.
 *
 * En développement et en prévisualisation, ce proxy joue le rôle que tiendra le
 * reverse proxy en production (ADR-002) : le code applicatif n'a jamais d'URL
 * absolue à connaître, donc rien à reconfigurer selon l'environnement.
 */
const apiTarget = process.env.API_URL ?? "http://127.0.0.1:3000";

const apiProxy = {
  // Pas de réécriture : l'API expose elle-même son préfixe `/api`
  // (`apps/api/src/configure-app.ts`), en développement comme en production.
  "/api": { target: apiTarget, changeOrigin: true },
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Nouvelle version détectée → le service worker se met à jour et
      // l'application propose de recharger (ADR-003). Jamais de version figée
      // chez un client.
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Ascenseur — back-office",
        short_name: "Ascenseur",
        description: "Gestion, maintenance et interventions sur parc d'ascenseurs",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0f172a",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [{ name: "Parc", url: "/", description: "Consulter le parc d'appareils" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Lecture des données : réseau d'abord, cache en secours. Le
            // dispatcher garde une vue consultable en coupure réseau ; la
            // saisie, elle, exige le réseau (ADR-003).
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith("/api/") && request.method === "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "asc-api-lecture",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Hôte explicite : `localhost` se résout en ::1 sur macOS, et les e2e
  // comme le proxy visent 127.0.0.1.
  server: { host: "127.0.0.1", port: 5173, proxy: apiProxy },
  preview: { host: "127.0.0.1", port: 4173, proxy: apiProxy },
});
