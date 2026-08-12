import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = resolve(webRoot, "..", "api");

/**
 * Repart d'un jeu de données neuf avant chaque exécution.
 *
 * La suite doit être déterministe : des appareils laissés par une exécution
 * précédente feraient passer ou échouer des tests au hasard.
 */
export default function globalSetup(): void {
  const dataDir = join(webRoot, ".e2e-data");
  rmSync(dataDir, { recursive: true, force: true });

  execFileSync(process.execPath, [join(apiRoot, "dist", "seed.js")], {
    cwd: webRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      JWT_SECRET: "secret-e2e-suffisamment-long-pour-passer-zod",
    },
  });
}
