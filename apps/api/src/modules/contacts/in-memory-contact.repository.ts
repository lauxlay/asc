import type { Contact, Id } from "@asc/domain";
import type { ContactRepository } from "./contact.repository.js";

/**
 * Adaptateur mémoire du port `ContactRepository`.
 *
 * Il existe pour deux raisons :
 * 1. prouver que la suite de tests de contrat est réellement indépendante de
 *    l'implémentation — validée contre une seule, elle ne prouverait rien ;
 * 2. donner aux tests des couches supérieures un stockage sans disque.
 *
 * Ce n'est pas un mode de fonctionnement de l'application : rien ne survit au
 * redémarrage.
 */
export class InMemoryContactRepository implements ContactRepository {
  /** Ordre d'insertion préservé, comme le fichier JSON. */
  readonly #contacts = new Map<string, Contact>();

  static #keyOf(tenantId: Id, id: Id): string {
    return `${tenantId} ${id}`;
  }

  async findById(tenantId: Id, id: Id): Promise<Contact | null> {
    return this.#contacts.get(InMemoryContactRepository.#keyOf(tenantId, id)) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Contact[]> {
    return [...this.#contacts.values()].filter((contact) => contact.tenantId === tenantId);
  }

  async save(contact: Contact): Promise<void> {
    this.#contacts.set(InMemoryContactRepository.#keyOf(contact.tenantId, contact.id), {
      ...contact,
    });
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    return this.#contacts.delete(InMemoryContactRepository.#keyOf(tenantId, id));
  }
}
