import type { Contract, Id } from "@asc/domain";

/**
 * Port de persistance des contrats d'entretien (ADR-001).
 *
 * Même forme que les autres ports : les services dépendent de cette
 * **interface**, jamais d'une implémentation, et `tenantId` est le premier
 * paramètre de chaque lecture — l'isolation est une propriété du port.
 */
export interface ContractRepository {
  /** `null` si le contrat n'existe pas **ou** appartient à un autre tenant. */
  findById(tenantId: Id, id: Id): Promise<Contract | null>;

  /** Tous les contrats du tenant, dans leur ordre d'insertion. */
  findAll(tenantId: Id): Promise<readonly Contract[]>;

  /** Insère ou remplace le contrat, selon son `id`. */
  save(contract: Contract): Promise<void>;

  /** `true` si un contrat a bien été supprimé, `false` s'il n'existait pas. */
  deleteById(tenantId: Id, id: Id): Promise<boolean>;
}
