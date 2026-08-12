import { randomUUID } from "node:crypto";
import { isoDate, type Unit } from "@asc/domain";
import { DEFAULT_TENANT_ID } from "./auth/auth.service.js";
import { hashPassword } from "./auth/password.js";
import { loadConfig } from "./config/env.js";
import { JsonUnitRepository } from "./modules/units/json-unit.repository.js";
import { JsonUserRepository } from "./modules/users/json-user.repository.js";
import { JsonCollectionStore } from "./storage/json-collection-store.js";

/**
 * Jeu de données de démonstration (`docs/03-application/09-decoupage-execution-opus.md`,
 * garde-fou n°3) : les e2e et les démos design partners tournent dessus.
 *
 * Idempotent sur l'utilisateur (identifiant fixe), donc rejouable sans
 * dupliquer le compte de démonstration.
 */

const DEMO_EMAIL = "dispatcher@ascenseur.test";
const DEMO_PASSWORD = "ascenseur-demo-2026";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export async function seed(dataDir: string): Promise<void> {
  const store = new JsonCollectionStore(dataDir);
  const users = new JsonUserRepository(store);
  const units = new JsonUnitRepository(store);

  await users.save({
    id: DEMO_USER_ID,
    tenantId: DEFAULT_TENANT_ID,
    email: DEMO_EMAIL,
    role: "dispatcher",
    passwordHash: await hashPassword(DEMO_PASSWORD),
  });

  const existing = await units.findAll(DEFAULT_TENANT_ID);
  if (existing.length === 0) {
    const demoUnits: readonly Unit[] = [
      {
        id: randomUUID(),
        tenantId: DEFAULT_TENANT_ID,
        siteId: "site-demo-1",
        commissionedOn: isoDate("2015-06-01"),
        lastStatutoryInspectionOn: isoDate("2021-06-15"),
      },
      {
        id: randomUUID(),
        tenantId: DEFAULT_TENANT_ID,
        siteId: "site-demo-2",
        commissionedOn: isoDate("2022-11-20"),
        lastStatutoryInspectionOn: null,
      },
    ];
    for (const unit of demoUnits) {
      await units.save(unit);
    }
  }

  process.stdout.write(
    `Seed terminé dans ${dataDir}\n  utilisateur : ${DEMO_EMAIL}\n  mot de passe : ${DEMO_PASSWORD}\n`,
  );
}

await seed(loadConfig().DATA_DIR);
