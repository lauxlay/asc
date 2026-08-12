import type { Id, User } from "@asc/domain";

/**
 * Utilisateur tel qu'il est stocké : l'entité du domaine plus son secret.
 *
 * Le domaine ignore volontairement `passwordHash` — l'authentification est une
 * affaire d'adaptateur, pas de règle métier.
 */
export interface PersistedUser extends User {
  readonly passwordHash: string;
}

/** Port de persistance des utilisateurs (ADR-001). */
export interface UserRepository {
  /** Recherche par email, **insensible à la casse**. `null` si aucun. */
  findByEmail(tenantId: Id, email: string): Promise<PersistedUser | null>;

  findById(tenantId: Id, id: Id): Promise<PersistedUser | null>;

  save(user: PersistedUser): Promise<void>;
}
