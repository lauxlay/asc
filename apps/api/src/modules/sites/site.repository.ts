import type { Id, Site } from "@asc/domain";

/**
 * Port de persistance des sites (ADR-001).
 *
 * Même forme que `UnitRepository` : les services dépendent de cette
 * **interface**, jamais d'une implémentation, et `tenantId` est le premier
 * paramètre de chaque lecture — l'isolation est une propriété du port.
 *
 * Volontairement sans méthode de recherche : le filtrage par adresse est une
 * règle métier (`siteMatchesQuery`, spec 002 R2) appliquée au-dessus de
 * `findAll`. L'ajouter ici avant qu'un stockage sache l'exécuter serait une
 * abstraction spéculative (règle 7 de `07-phase0-fondations.md`).
 */
export interface SiteRepository {
  /** `null` si le site n'existe pas **ou** appartient à un autre tenant. */
  findById(tenantId: Id, id: Id): Promise<Site | null>;

  /** Tous les sites du tenant, dans leur ordre d'insertion. */
  findAll(tenantId: Id): Promise<readonly Site[]>;

  /** Insère ou remplace le site, selon son `id`. */
  save(site: Site): Promise<void>;

  /** `true` si un site a bien été supprimé, `false` s'il n'existait pas. */
  deleteById(tenantId: Id, id: Id): Promise<boolean>;
}
