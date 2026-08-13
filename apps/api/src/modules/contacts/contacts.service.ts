import { randomUUID } from "node:crypto";
import type { CreateContactRequest, UpdateContactRequest } from "@asc/contracts";
import type { Contact, Id } from "@asc/domain";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CONTACT_REPOSITORY, CUSTOMER_REPOSITORY, SITE_REPOSITORY } from "../../common/tokens.js";
import type { CustomerRepository } from "../customers/customer.repository.js";
import type { SiteRepository } from "../sites/site.repository.js";
import type { ContactRepository } from "./contact.repository.js";

/** Filtres de `GET /contacts`. */
export interface ContactFilters {
  readonly customerId?: Id | undefined;
  readonly siteId?: Id | undefined;
}

/**
 * Orchestration des interlocuteurs clients.
 *
 * Le service dépend des **ports**, jamais d'une implémentation (ADR-001), et
 * reçoit toujours le `tenantId` du jeton.
 */
@Injectable()
export class ContactsService {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
  ) {}

  async list(tenantId: Id, filters: ContactFilters): Promise<readonly Contact[]> {
    const contacts = await this.contacts.findAll(tenantId);
    return contacts.filter(
      (contact) =>
        (filters.customerId === undefined || contact.customerId === filters.customerId) &&
        (filters.siteId === undefined || contact.siteId === filters.siteId),
    );
  }

  async getById(tenantId: Id, id: Id): Promise<Contact> {
    const contact = await this.contacts.findById(tenantId, id);
    if (contact === null) {
      throw new NotFoundException(`Contact ${id} introuvable`);
    }
    return contact;
  }

  /** L'identifiant est un UUID généré par l'application (ADR-001). */
  async create(tenantId: Id, input: CreateContactRequest): Promise<Contact> {
    await this.#assertAttachable(tenantId, input.customerId, input.siteId);

    const contact: Contact = {
      id: randomUUID(),
      tenantId,
      customerId: input.customerId,
      siteId: input.siteId,
      name: input.name,
      role: input.role,
      email: input.email,
      phone: input.phone,
    };
    await this.contacts.save(contact);
    return contact;
  }

  /** PATCH : seuls les champs fournis remplacent l'existant. */
  async update(tenantId: Id, id: Id, changes: UpdateContactRequest): Promise<Contact> {
    const current = await this.getById(tenantId, id);
    const customerId = changes.customerId ?? current.customerId;
    const siteId = changes.siteId === undefined ? current.siteId : changes.siteId;

    // Revalidé même quand un seul des deux change : déplacer le contact vers un
    // autre client sans toucher au `siteId` casserait sinon l'invariant R2.2.
    if (changes.customerId !== undefined || changes.siteId !== undefined) {
      await this.#assertAttachable(tenantId, customerId, siteId);
    }

    const updated: Contact = {
      ...current,
      customerId,
      siteId,
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.role === undefined ? {} : { role: changes.role }),
      ...(changes.email === undefined ? {} : { email: changes.email }),
      ...(changes.phone === undefined ? {} : { phone: changes.phone }),
    };
    await this.contacts.save(updated);
    return updated;
  }

  async delete(tenantId: Id, id: Id): Promise<void> {
    if (!(await this.contacts.deleteById(tenantId, id))) {
      throw new NotFoundException(`Contact ${id} introuvable`);
    }
  }

  /**
   * Le client doit exister, et l'immeuble éventuel doit lui appartenir
   * (spec 003, R2).
   *
   * Déclarer le gardien d'un immeuble géré par un autre syndic n'a pas de sens
   * et ferait fuir de l'information entre clients. Les ressources d'un autre
   * tenant sont traitées comme inconnues.
   */
  async #assertAttachable(tenantId: Id, customerId: Id, siteId: Id | null): Promise<void> {
    if ((await this.customers.findById(tenantId, customerId)) === null) {
      throw new BadRequestException(`Client ${customerId} introuvable`);
    }
    if (siteId === null) {
      return;
    }
    const site = await this.sites.findById(tenantId, siteId);
    if (site === null) {
      throw new BadRequestException(`Site ${siteId} introuvable`);
    }
    if (site.customerId !== customerId) {
      throw new BadRequestException(`Le site ${siteId} n'est pas rattaché à ce client`);
    }
  }
}
