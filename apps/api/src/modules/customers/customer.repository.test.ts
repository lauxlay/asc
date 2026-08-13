import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonCollectionStore } from "../../storage/json-collection-store.js";
import { describeCustomerRepositoryContract } from "./customer.repository.contract.js";
import { InMemoryCustomerRepository } from "./in-memory-customer.repository.js";
import { JsonCustomerRepository } from "./json-customer.repository.js";

/**
 * La même suite de contrat, exécutée contre les deux implémentations du port.
 * Le jour où `SqliteCustomerRepository` arrive, il suffit d'ajouter une ligne
 * ici : c'est la garantie de migration de l'ADR-001.
 */

describeCustomerRepositoryContract("JsonCustomerRepository", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "asc-customers-"));
  return {
    repository: new JsonCustomerRepository(new JsonCollectionStore(rootDir)),
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
});

describeCustomerRepositoryContract("InMemoryCustomerRepository", async () => ({
  repository: new InMemoryCustomerRepository(),
}));
