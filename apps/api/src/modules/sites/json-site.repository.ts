import type { Id, Site } from "@asc/domain";
import type { JsonCollectionStore } from "../../storage/json-collection-store.js";
import type { SiteRepository } from "./site.repository.js";
import { siteSchema } from "./site.schema.js";

const COLLECTION = "sites";

/**
 * Adaptateur JSON du port `SiteRepository` — implémentation Phase 0 (ADR-001).
 *
 * Sera remplacé par `SqliteSiteRepository` en Phase 1 : la suite de tests de
 * contrat (`site.repository.contract.ts`) valide alors l'équivalence.
 */
export class JsonSiteRepository implements SiteRepository {
  readonly #store: JsonCollectionStore;

  constructor(store: JsonCollectionStore) {
    this.#store = store;
  }

  async findById(tenantId: Id, id: Id): Promise<Site | null> {
    const sites = await this.findAll(tenantId);
    return sites.find((site) => site.id === id) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Site[]> {
    return this.#store.read({ tenantId, collection: COLLECTION }, siteSchema);
  }

  async save(site: Site): Promise<void> {
    await this.#store.update(
      { tenantId: site.tenantId, collection: COLLECTION },
      siteSchema,
      (sites) => {
        const index = sites.findIndex((candidate) => candidate.id === site.id);
        if (index === -1) {
          return [...sites, site];
        }
        return sites.map((candidate, position) => (position === index ? site : candidate));
      },
    );
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    let deleted = false;
    await this.#store.update({ tenantId, collection: COLLECTION }, siteSchema, (sites) => {
      const remaining = sites.filter((site) => site.id !== id);
      deleted = remaining.length !== sites.length;
      return remaining;
    });
    return deleted;
  }
}
