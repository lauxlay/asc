import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonCollectionStore } from "../../storage/json-collection-store.js";
import { InMemoryUnitRepository } from "./in-memory-unit.repository.js";
import { JsonUnitRepository } from "./json-unit.repository.js";
import { describeUnitRepositoryContract } from "./unit.repository.contract.js";

/**
 * La même suite de contrat, exécutée contre les deux implémentations du port.
 * Le jour où `SqliteUnitRepository` arrive, il suffit d'ajouter une ligne ici :
 * c'est la garantie de migration de l'ADR-001.
 */

describeUnitRepositoryContract("JsonUnitRepository", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "asc-units-"));
  return {
    repository: new JsonUnitRepository(new JsonCollectionStore(rootDir)),
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
});

describeUnitRepositoryContract("InMemoryUnitRepository", async () => ({
  repository: new InMemoryUnitRepository(),
}));
