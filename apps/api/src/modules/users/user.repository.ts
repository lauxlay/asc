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
  /**
   * Insère l'utilisateur **si son email est libre dans le tenant**, et rend
   * `null` si l'email est déjà pris.
   *
   * La vérification appartient à l'adaptateur et non au service, pour la même
   * raison que la numérotation des OT (spec 007, R6.3) : un « je lis, puis
   * j'écris » côté service laisse deux créations simultanées passer toutes les
   * deux. Deux comptes du même email, c'est une identité de connexion qui en
   * désigne deux — l'un des deux ne se connectera jamais.
   *
   * L'email est comparé **sans tenir compte de la casse ni des espaces**,
   * comme `findByEmail`.
   */
  createIfEmailFree(user: PersistedUser): Promise<PersistedUser | null>;

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
