import type { Id } from "@asc/domain";
import type { JsonCollectionStore } from "../../storage/json-collection-store.js";
import type { PersistedUser, UserRepository } from "./user.repository.js";
import { persistedUserSchema } from "./user.schema.js";

const COLLECTION = "users";

/** Adaptateur JSON du port `UserRepository` — implémentation Phase 0 (ADR-001). */
export class JsonUserRepository implements UserRepository {
  readonly #store: JsonCollectionStore;

  constructor(store: JsonCollectionStore) {
    this.#store = store;
  }

  async findByEmail(tenantId: Id, email: string): Promise<PersistedUser | null> {
    const normalized = email.trim().toLowerCase();
    const users = await this.#all(tenantId);
    return users.find((user) => user.email.toLowerCase() === normalized) ?? null;
  }

  async findById(tenantId: Id, id: Id): Promise<PersistedUser | null> {
    const users = await this.#all(tenantId);
    return users.find((user) => user.id === id) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly PersistedUser[]> {
    return this.#all(tenantId);
  }

  async save(user: PersistedUser): Promise<void> {
    await this.#store.update(
      { tenantId: user.tenantId, collection: COLLECTION },
      persistedUserSchema,
      (users) => {
        const index = users.findIndex((candidate) => candidate.id === user.id);
        if (index === -1) {
          return [...users, user];
        }
        return users.map((candidate, position) => (position === index ? user : candidate));
      },
    );
  }

  async #all(tenantId: Id): Promise<readonly PersistedUser[]> {
    return this.#store.read({ tenantId, collection: COLLECTION }, persistedUserSchema);
  }
}
