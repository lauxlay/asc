import { randomUUID } from "node:crypto";
import type { CreateSiteRequest, UpdateSiteRequest } from "@asc/contracts";
import { type Id, type Site, siteMatchesQuery } from "@asc/domain";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CONTACT_REPOSITORY,
  CUSTOMER_REPOSITORY,
  SITE_REPOSITORY,
  UNIT_REPOSITORY,
} from "../../common/tokens.js";
import type { ContactRepository } from "../contacts/contact.repository.js";
import type { CustomerRepository } from "../customers/customer.repository.js";
import type { UnitRepository } from "../units/unit.repository.js";
import type { SiteRepository } from "./site.repository.js";

/** Filtres de `GET /sites`. */
export interface SiteFilters {
  readonly q?: string | undefined;
  readonly customerId?: Id | undefined;
}

/**
 * Orchestration du parc d'immeubles.
 *
 * Le service dépend des **ports**, jamais d'une implémentation (ADR-001), et
 * reçoit toujours le `tenantId` du jeton : aucune méthode ne peut lire ou
 * écrire hors du tenant de l'appelant.
 *
 * Il connaît les ports des appareils et des contacts pour une seule raison :
 * refuser de supprimer un immeuble encore rattaché (spec 002 R3, spec 003 R4).
 */
@Injectable()
export class SitesService {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
  ) {}

  /**
   * Liste filtrée par la règle de recherche du domaine (spec 002, R2) et par
   * le client (spec 003).
   *
   * Le filtrage a lieu ici, pas dans le port : voir `site.repository.ts`.
   */
  async list(tenantId: Id, filters: SiteFilters): Promise<readonly Site[]> {
    const sites = await this.sites.findAll(tenantId);
    return sites.filter(
      (site) =>
        (filters.q === undefined || siteMatchesQuery(site, filters.q)) &&
        (filters.customerId === undefined || site.customerId === filters.customerId),
    );
  }

  async getById(tenantId: Id, id: Id): Promise<Site> {
    const site = await this.sites.findById(tenantId, id);
    if (site === null) {
      throw new NotFoundException(`Site ${id} introuvable`);
    }
    return site;
  }

  /** L'identifiant est un UUID généré par l'application (ADR-001). */
  async create(tenantId: Id, input: CreateSiteRequest): Promise<Site> {
    await this.#assertCustomerExists(tenantId, input.customerId);

    const site: Site = {
      id: randomUUID(),
      tenantId,
      customerId: input.customerId,
      name: input.name,
      addressLine: input.addressLine,
      postalCode: input.postalCode,
      city: input.city,
    };
    await this.sites.save(site);
    return site;
  }

  /** PATCH : seuls les champs fournis remplacent l'existant. */
  async update(tenantId: Id, id: Id, changes: UpdateSiteRequest): Promise<Site> {
    const current = await this.getById(tenantId, id);
    if (changes.customerId !== undefined) {
      await this.#assertCustomerExists(tenantId, changes.customerId);
      await this.#assertNoContactLeftBehind(tenantId, id, changes.customerId, current.customerId);
    }

    const updated: Site = {
      ...current,
      ...(changes.customerId === undefined ? {} : { customerId: changes.customerId }),
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.addressLine === undefined ? {} : { addressLine: changes.addressLine }),
      ...(changes.postalCode === undefined ? {} : { postalCode: changes.postalCode }),
      ...(changes.city === undefined ? {} : { city: changes.city }),
    };
    await this.sites.save(updated);
    return updated;
  }

  /**
   * Un immeuble encore rattaché n'est pas supprimable (spec 002 R3, spec 003 R4).
   *
   * Supprimer en cascade détruirait des appareils portant un historique de
   * conformité : dans un produit à valeur probante, la donnée ne disparaît pas
   * par effet de bord.
   */
  async delete(tenantId: Id, id: Id): Promise<void> {
    const units = (await this.units.findAll(tenantId)).filter((unit) => unit.siteId === id);
    if (units.length > 0) {
      throw new ConflictException(
        `Ce site porte encore ${units.length} appareil(s) : supprimez-les d'abord`,
      );
    }

    const contacts = (await this.contacts.findAll(tenantId)).filter(
      (contact) => contact.siteId === id,
    );
    if (contacts.length > 0) {
      throw new ConflictException(
        `Ce site porte encore ${contacts.length} contact(s) : supprimez-les d'abord`,
      );
    }

    if (!(await this.sites.deleteById(tenantId, id))) {
      throw new NotFoundException(`Site ${id} introuvable`);
    }
  }

  /**
   * Le client d'un immeuble existe, ou il n'y en a pas (spec 003, R1).
   *
   * Un client d'un autre tenant est traité comme inconnu — un écart révélerait
   * l'existence de la donnée d'autrui.
   */
  async #assertCustomerExists(tenantId: Id, customerId: Id | null): Promise<void> {
    if (customerId === null) {
      return;
    }
    if ((await this.customers.findById(tenantId, customerId)) === null) {
      throw new BadRequestException(`Client ${customerId} introuvable`);
    }
  }

  /**
   * Changer le client d'un immeuble laisserait ses contacts rattachés au client
   * précédent, ce que l'invariant R2.2 interdit. On refuse plutôt que de
   * réaffecter des contacts dans le dos de l'utilisateur.
   */
  async #assertNoContactLeftBehind(
    tenantId: Id,
    siteId: Id,
    nextCustomerId: Id | null,
    currentCustomerId: Id | null,
  ): Promise<void> {
    if (nextCustomerId === currentCustomerId) {
      return;
    }
    const attached = (await this.contacts.findAll(tenantId)).filter(
      (contact) => contact.siteId === siteId,
    );
    if (attached.length > 0) {
      throw new ConflictException(
        `Ce site porte ${attached.length} contact(s) rattaché(s) à son client actuel : supprimez-les avant de le transférer`,
      );
    }
  }
}
