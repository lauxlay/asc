import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonCollectionStore } from "../../storage/json-collection-store.js";
import { describeContactRepositoryContract } from "./contact.repository.contract.js";
import { InMemoryContactRepository } from "./in-memory-contact.repository.js";
import { JsonContactRepository } from "./json-contact.repository.js";

/**
 * La même suite de contrat, exécutée contre les deux implémentations du port.
 * Le jour où `SqliteContactRepository` arrive, il suffit d'ajouter une ligne
 * ici : c'est la garantie de migration de l'ADR-001.
 */

describeContactRepositoryContract("JsonContactRepository", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "asc-contacts-"));
  return {
    repository: new JsonContactRepository(new JsonCollectionStore(rootDir)),
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
});

describeContactRepositoryContract("InMemoryContactRepository", async () => ({
  repository: new InMemoryContactRepository(),
}));
