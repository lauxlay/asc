import type { Contact, Id } from "@asc/domain";
import type { JsonCollectionStore } from "../../storage/json-collection-store.js";
import type { ContactRepository } from "./contact.repository.js";
import { contactSchema } from "./contact.schema.js";

const COLLECTION = "contacts";

/**
 * Adaptateur JSON du port `ContactRepository` — implémentation Phase 0 (ADR-001).
 *
 * Sera remplacé par `SqliteContactRepository` en Phase 1 : la suite de tests de
 * contrat (`contact.repository.contract.ts`) valide alors l'équivalence.
 */
export class JsonContactRepository implements ContactRepository {
  readonly #store: JsonCollectionStore;

  constructor(store: JsonCollectionStore) {
    this.#store = store;
  }

  async findById(tenantId: Id, id: Id): Promise<Contact | null> {
    const contacts = await this.findAll(tenantId);
    return contacts.find((contact) => contact.id === id) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Contact[]> {
    return this.#store.read({ tenantId, collection: COLLECTION }, contactSchema);
  }

  async save(contact: Contact): Promise<void> {
    await this.#store.update(
      { tenantId: contact.tenantId, collection: COLLECTION },
      contactSchema,
      (contacts) => {
        const index = contacts.findIndex((candidate) => candidate.id === contact.id);
        if (index === -1) {
          return [...contacts, contact];
        }
        return contacts.map((candidate, position) => (position === index ? contact : candidate));
      },
    );
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    let deleted = false;
    await this.#store.update({ tenantId, collection: COLLECTION }, contactSchema, (contacts) => {
      const remaining = contacts.filter((contact) => contact.id !== id);
      deleted = remaining.length !== contacts.length;
      return remaining;
    });
    return deleted;
  }
}
