import type { Id } from "@asc/domain";
import type { PersistedUser, UserRepository } from "./user.repository.js";

/** Adaptateur mémoire du port `UserRepository` — tests uniquement, rien ne survit. */
export class InMemoryUserRepository implements UserRepository {
  readonly #users = new Map<string, PersistedUser>();

  static #keyOf(tenantId: Id, id: Id): string {
    return `${tenantId} ${id}`;
  }

  async findByEmail(tenantId: Id, email: string): Promise<PersistedUser | null> {
    const normalized = email.trim().toLowerCase();
    return (
      [...this.#users.values()].find(
        (user) => user.tenantId === tenantId && user.email.toLowerCase() === normalized,
      ) ?? null
    );
  }

  async findById(tenantId: Id, id: Id): Promise<PersistedUser | null> {
    return this.#users.get(InMemoryUserRepository.#keyOf(tenantId, id)) ?? null;
  }

  async save(user: PersistedUser): Promise<void> {
    this.#users.set(InMemoryUserRepository.#keyOf(user.tenantId, user.id), { ...user });
  }
}
