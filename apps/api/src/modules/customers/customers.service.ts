import { randomUUID } from "node:crypto";
import type { CreateCustomerRequest, UpdateCustomerRequest } from "@asc/contracts";
import type { Customer, Id } from "@asc/domain";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CONTACT_REPOSITORY, CUSTOMER_REPOSITORY, SITE_REPOSITORY } from "../../common/tokens.js";
import type { ContactRepository } from "../contacts/contact.repository.js";
import type { SiteRepository } from "../sites/site.repository.js";
import type { CustomerRepository } from "./customer.repository.js";

/**
 * Orchestration du portefeuille client.
 *
 * Le service dépend des **ports**, jamais d'une implémentation (ADR-001), et
 * reçoit toujours le `tenantId` du jeton.
 *
 * Il connaît les ports des immeubles et des contacts pour une seule raison :
 * refuser de supprimer un client encore rattaché (spec 003, R3).
 */
@Injectable()
export class CustomersService {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
  ) {}

  async list(tenantId: Id): Promise<readonly Customer[]> {
    return this.customers.findAll(tenantId);
  }

  async getById(tenantId: Id, id: Id): Promise<Customer> {
    const customer = await this.customers.findById(tenantId, id);
    if (customer === null) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }
    return customer;
  }

  /** L'identifiant est un UUID généré par l'application (ADR-001). */
  async create(tenantId: Id, input: CreateCustomerRequest): Promise<Customer> {
    const customer: Customer = {
      id: randomUUID(),
      tenantId,
      name: input.name,
      type: input.type,
    };
    await this.customers.save(customer);
    return customer;
  }

  /** PATCH : seuls les champs fournis remplacent l'existant. */
  async update(tenantId: Id, id: Id, changes: UpdateCustomerRequest): Promise<Customer> {
    const current = await this.getById(tenantId, id);
    const updated: Customer = {
      ...current,
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.type === undefined ? {} : { type: changes.type }),
    };
    await this.customers.save(updated);
    return updated;
  }

  /**
   * Un client encore rattaché n'est pas supprimable (spec 003, R3).
   *
   * Ni cascade sur les immeubles, ni cascade sur les contacts : dans un produit
   * à valeur probante, la donnée ne disparaît pas par effet de bord.
   */
  async delete(tenantId: Id, id: Id): Promise<void> {
    const sites = (await this.sites.findAll(tenantId)).filter((site) => site.customerId === id);
    if (sites.length > 0) {
      throw new ConflictException(
        `Ce client porte encore ${sites.length} immeuble(s) : détachez-les d'abord`,
      );
    }

    const contacts = (await this.contacts.findAll(tenantId)).filter(
      (contact) => contact.customerId === id,
    );
    if (contacts.length > 0) {
      throw new ConflictException(
        `Ce client porte encore ${contacts.length} contact(s) : supprimez-les d'abord`,
      );
    }

    if (!(await this.customers.deleteById(tenantId, id))) {
      throw new NotFoundException(`Client ${id} introuvable`);
    }
  }
}
