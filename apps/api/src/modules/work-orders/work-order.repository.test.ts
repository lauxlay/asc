import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonCollectionStore } from "../../storage/json-collection-store.js";
import { InMemoryWorkOrderRepository } from "./in-memory-work-order.repository.js";
import { JsonWorkOrderRepository } from "./json-work-order.repository.js";
import { describeWorkOrderRepositoryContract } from "./work-order.repository.contract.js";

/**
 * La même suite de contrat, exécutée contre les deux implémentations du port.
 * Le jour où `SqliteWorkOrderRepository` arrive, il suffit d'ajouter une ligne
 * ici : c'est la garantie de migration de l'ADR-001.
 */

describeWorkOrderRepositoryContract("JsonWorkOrderRepository", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "asc-work-orders-"));
  return {
    repository: new JsonWorkOrderRepository(new JsonCollectionStore(rootDir)),
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
});

describeWorkOrderRepositoryContract("InMemoryWorkOrderRepository", async () => ({
  repository: new InMemoryWorkOrderRepository(),
}));
