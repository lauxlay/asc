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

  /**
   * Tous les utilisateurs du tenant, **actifs et désactivés**, du plus ancien
   * au plus récent.
   *
   * Les désactivés en font partie volontairement : ils portent encore des OT
   * passés, et le planning doit pouvoir les afficher pour que rien ne
   * disparaisse en silence (spec 008, R5.3).
   */
  findAll(tenantId: Id): Promise<readonly PersistedUser[]>;

  save(user: PersistedUser): Promise<void>;
}
