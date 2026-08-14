import type { Id } from "@asc/domain";
import type { PersistedUser, UserRepository } from "./user.repository.js";

/** Un email se compare sans casse ni espaces de bord — ici comme à la recherche. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Adaptateur mémoire du port `UserRepository` — tests uniquement, rien ne survit. */
export class InMemoryUserRepository implements UserRepository {
  readonly #users = new Map<string, PersistedUser>();

  static #keyOf(tenantId: Id, id: Id): string {
    return `${tenantId} ${id}`;
  }

  /**
   * Vérification et insertion **sans point d'attente entre les deux** : rien ne
   * peut s'intercaler, ce qui reproduit l'atomicité du verrou de l'adaptateur
   * JSON.
   */
  async createIfEmailFree(user: PersistedUser): Promise<PersistedUser | null> {
    const normalized = normalizeEmail(user.email);
    const taken = [...this.#users.values()].some(
      (candidate) =>
        candidate.tenantId === user.tenantId && normalizeEmail(candidate.email) === normalized,
    );
    if (taken) {
      return null;
    }
    this.#users.set(InMemoryUserRepository.#keyOf(user.tenantId, user.id), { ...user });
    return user;
  }

  async findByEmail(tenantId: Id, email: string): Promise<PersistedUser | null> {
    const normalized = normalizeEmail(email);
    return (
      [...this.#users.values()].find(
        (user) => user.tenantId === tenantId && normalizeEmail(user.email) === normalized,
      ) ?? null
    );
  }

  async findById(tenantId: Id, id: Id): Promise<PersistedUser | null> {
    return this.#users.get(InMemoryUserRepository.#keyOf(tenantId, id)) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly PersistedUser[]> {
    // L'ordre d'insertion d'une `Map` est stable : même ordre que l'adaptateur
    // JSON, qui rend les enregistrements dans l'ordre du fichier.
    return [...this.#users.values()].filter((user) => user.tenantId === tenantId);
  }

  async save(user: PersistedUser): Promise<void> {
    this.#users.set(InMemoryUserRepository.#keyOf(user.tenantId, user.id), { ...user });
  }
}
