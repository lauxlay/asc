import type { Id, Site } from "@asc/domain";
import type { SiteRepository } from "./site.repository.js";

/**
 * Adaptateur mémoire du port `SiteRepository`.
 *
 * Il existe pour deux raisons :
 * 1. prouver que la suite de tests de contrat est réellement indépendante de
 *    l'implémentation — validée contre une seule, elle ne prouverait rien ;
 * 2. donner aux tests des couches supérieures un stockage sans disque.
 *
 * Ce n'est pas un mode de fonctionnement de l'application : rien ne survit au
 * redémarrage.
 */
export class InMemorySiteRepository implements SiteRepository {
  /** Ordre d'insertion préservé, comme le fichier JSON. */
  readonly #sites = new Map<string, Site>();

  static #keyOf(tenantId: Id, id: Id): string {
    return `${tenantId} ${id}`;
  }

  async findById(tenantId: Id, id: Id): Promise<Site | null> {
    return this.#sites.get(InMemorySiteRepository.#keyOf(tenantId, id)) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Site[]> {
    return [...this.#sites.values()].filter((site) => site.tenantId === tenantId);
  }

  async save(site: Site): Promise<void> {
    this.#sites.set(InMemorySiteRepository.#keyOf(site.tenantId, site.id), { ...site });
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    return this.#sites.delete(InMemorySiteRepository.#keyOf(tenantId, id));
  }
}
