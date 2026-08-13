import type { Customer, Id } from "@asc/domain";
import type { CustomerRepository } from "./customer.repository.js";

/**
 * Adaptateur mémoire du port `CustomerRepository`.
 *
 * Il existe pour deux raisons :
 * 1. prouver que la suite de tests de contrat est réellement indépendante de
 *    l'implémentation — validée contre une seule, elle ne prouverait rien ;
 * 2. donner aux tests des couches supérieures un stockage sans disque.
 *
 * Ce n'est pas un mode de fonctionnement de l'application : rien ne survit au
 * redémarrage.
 */
export class InMemoryCustomerRepository implements CustomerRepository {
  /** Ordre d'insertion préservé, comme le fichier JSON. */
  readonly #customers = new Map<string, Customer>();

  static #keyOf(tenantId: Id, id: Id): string {
    return `${tenantId} ${id}`;
  }

  async findById(tenantId: Id, id: Id): Promise<Customer | null> {
    return this.#customers.get(InMemoryCustomerRepository.#keyOf(tenantId, id)) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Customer[]> {
    return [...this.#customers.values()].filter((customer) => customer.tenantId === tenantId);
  }

  async save(customer: Customer): Promise<void> {
    this.#customers.set(InMemoryCustomerRepository.#keyOf(customer.tenantId, customer.id), {
      ...customer,
    });
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    return this.#customers.delete(InMemoryCustomerRepository.#keyOf(tenantId, id));
  }
}
