import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonCollectionStore } from "../../storage/json-collection-store.js";
import { InMemorySiteRepository } from "./in-memory-site.repository.js";
import { JsonSiteRepository } from "./json-site.repository.js";
import { describeSiteRepositoryContract } from "./site.repository.contract.js";

/**
 * La même suite de contrat, exécutée contre les deux implémentations du port.
 * Le jour où `SqliteSiteRepository` arrive, il suffit d'ajouter une ligne ici :
 * c'est la garantie de migration de l'ADR-001.
 */

describeSiteRepositoryContract("JsonSiteRepository", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "asc-sites-"));
  return {
    repository: new JsonSiteRepository(new JsonCollectionStore(rootDir)),
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
});

describeSiteRepositoryContract("InMemorySiteRepository", async () => ({
  repository: new InMemorySiteRepository(),
}));
