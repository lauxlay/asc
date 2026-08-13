import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonCollectionStore } from "../../storage/json-collection-store.js";
import { describeContractRepositoryContract } from "./contract.repository.contract.js";
import { InMemoryContractRepository } from "./in-memory-contract.repository.js";
import { JsonContractRepository } from "./json-contract.repository.js";

/**
 * La même suite de contrat, exécutée contre les deux implémentations du port.
 * Le jour où `SqliteContractRepository` arrive, il suffit d'ajouter une ligne
 * ici : c'est la garantie de migration de l'ADR-001.
 */

describeContractRepositoryContract("JsonContractRepository", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "asc-contracts-"));
  return {
    repository: new JsonContractRepository(new JsonCollectionStore(rootDir)),
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
});

describeContractRepositoryContract("InMemoryContractRepository", async () => ({
  repository: new InMemoryContractRepository(),
}));
