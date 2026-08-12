import { expect, test } from "@playwright/test";

/**
 * Vérifie que le back-office est réellement installable (ADR-003).
 *
 * Ce sont les conditions objectives d'installabilité : un manifeste valide avec
 * les icônes attendues, et un service worker enregistré. Le geste
 * d'installation lui-même appartient au navigateur, pas à l'application.
 */

test("l'application expose un manifeste installable", async ({ page, request }) => {
  await page.goto("/login");

  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const manifest = await (await request.get(href as string)).json();

  expect(manifest.name).toBe("Ascenseur — back-office");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");

  const sizes = (manifest.icons as { sizes: string }[]).map((icon) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");

  // Une icône « maskable » évite le rendu en pastille tronquée sur Android.
  const maskable = (manifest.icons as { purpose?: string }[]).some(
    (icon) => icon.purpose === "maskable",
  );
  expect(maskable).toBe(true);
});

test("les icônes du manifeste sont réellement servies", async ({ request }) => {
  for (const path of ["/icons/icon-192.png", "/icons/icon-512.png"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("un service worker est enregistré et prend le contrôle", async ({ page }) => {
  await page.goto("/login");

  // Au premier chargement le service worker s'installe sans contrôler la page
  // (pas de `clientsClaim`) : on attend d'abord l'enregistrement.
  await expect
    .poll(
      () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()) != null),
      { timeout: 15_000 },
    )
    .toBe(true);

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();

  // Au rechargement suivant, il sert la page : c'est ce qui rend le démarrage
  // instantané et l'application installable (ADR-003).
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 15_000,
    })
    .toBe(true);
});
