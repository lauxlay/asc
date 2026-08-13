import type { Contract, Id } from "@asc/domain";
import type { ContractRepository } from "./contract.repository.js";

/**
 * Adaptateur mémoire du port `ContractRepository`.
 *
 * Il existe pour deux raisons :
 * 1. prouver que la suite de tests de contrat est réellement indépendante de
 *    l'implémentation — validée contre une seule, elle ne prouverait rien ;
 * 2. donner aux tests des couches supérieures un stockage sans disque.
 *
 * Ce n'est pas un mode de fonctionnement de l'application : rien ne survit au
 * redémarrage.
 */
export class InMemoryContractRepository implements ContractRepository {
  /** Ordre d'insertion préservé, comme le fichier JSON. */
  readonly #contracts = new Map<string, Contract>();

  static #keyOf(tenantId: Id, id: Id): string {
    return `${tenantId} ${id}`;
  }

  async findById(tenantId: Id, id: Id): Promise<Contract | null> {
    return this.#contracts.get(InMemoryContractRepository.#keyOf(tenantId, id)) ?? null;
  }

  async findAll(tenantId: Id): Promise<readonly Contract[]> {
    return [...this.#contracts.values()].filter((contract) => contract.tenantId === tenantId);
  }

  async save(contract: Contract): Promise<void> {
    this.#contracts.set(InMemoryContractRepository.#keyOf(contract.tenantId, contract.id), {
      ...contract,
      unitIds: [...contract.unitIds],
    });
  }

  async deleteById(tenantId: Id, id: Id): Promise<boolean> {
    return this.#contracts.delete(InMemoryContractRepository.#keyOf(tenantId, id));
  }
}
