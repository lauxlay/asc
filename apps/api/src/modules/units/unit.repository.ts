import type { Id, Unit } from "@asc/domain";

/**
 * Port de persistance des appareils (ADR-001).
 *
 * Les services dépendent de cette **interface**, jamais d'une implémentation :
 * c'est ce qui rend la migration JSON → SQLite → PostgreSQL mécanique.
 *
 * Les méthodes sont métier, pas un langage de requêtes : chacune se
 * réimplémente en SQL sans toucher aux appelants.
 *
 * `tenantId` est le premier paramètre de chaque lecture — l'isolation entre
 * tenants est une propriété du port, pas une politesse de l'appelant.
 */
export interface UnitRepository {
  /** `null` si l'appareil n'existe pas **ou** appartient à un autre tenant. */
  findById(tenantId: Id, id: Id): Promise<Unit | null>;

  /** Tous les appareils du tenant, dans leur ordre d'insertion. */
  findAll(tenantId: Id): Promise<readonly Unit[]>;

  /** Insère ou remplace l'appareil, selon son `id`. */
  save(unit: Unit): Promise<void>;

  /** `true` si un appareil a bien été supprimé, `false` s'il n'existait pas. */
  deleteById(tenantId: Id, id: Id): Promise<boolean>;
}
