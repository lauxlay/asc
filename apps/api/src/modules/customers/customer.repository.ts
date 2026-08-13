import type { Customer, Id } from "@asc/domain";

/**
 * Port de persistance des clients (ADR-001).
 *
 * Même forme que `SiteRepository` et `UnitRepository` : les services dépendent
 * de cette **interface**, jamais d'une implémentation, et `tenantId` est le
 * premier paramètre de chaque lecture — l'isolation est une propriété du port.
 */
export interface CustomerRepository {
  /** `null` si le client n'existe pas **ou** appartient à un autre tenant. */
  findById(tenantId: Id, id: Id): Promise<Customer | null>;

  /** Tous les clients du tenant, dans leur ordre d'insertion. */
  findAll(tenantId: Id): Promise<readonly Customer[]>;

  /** Insère ou remplace le client, selon son `id`. */
  save(customer: Customer): Promise<void>;

  /** `true` si un client a bien été supprimé, `false` s'il n'existait pas. */
  deleteById(tenantId: Id, id: Id): Promise<boolean>;
}
