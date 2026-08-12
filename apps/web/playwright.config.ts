import { defineConfig, devices } from "@playwright/test";

/**
 * Suite e2e du back-office.
 *
 * Elle tourne contre l'**application buildée** et la **vraie API**, pas contre
 * des mocks : un parcours qui passe ici est un parcours qui marche. Le seed
 * fournit le jeu de données de démonstration (garde-fou n°3 du découpage).
 *
 * La suite est **cumulative** : chaque lot ajoute ses parcours ici et
 * l'ensemble tourne en CI sur chaque PR. Un test supprimé ou skippé est
 * bloquant en review.
 */

const API_PORT = 3999;
const WEB_PORT = 4173;
const DATA_DIR = ".e2e-data";
const JWT_SECRET = "secret-e2e-suffisamment-long-pour-passer-zod";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // Un test instable se répare, il ne se rejoue pas (garde-fou n°2).
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node ../../apps/api/dist/main.js",
      port: API_PORT,
      reuseExistingServer: false,
      env: {
        PORT: String(API_PORT),
        DATA_DIR,
        JWT_SECRET,
      },
    },
    {
      command: `pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: false,
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
