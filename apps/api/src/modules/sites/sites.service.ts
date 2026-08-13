import { randomUUID } from "node:crypto";
import type { CreateSiteRequest, UpdateSiteRequest } from "@asc/contracts";
import { type Id, type Site, siteMatchesQuery } from "@asc/domain";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { SITE_REPOSITORY, UNIT_REPOSITORY } from "../../common/tokens.js";
import type { UnitRepository } from "../units/unit.repository.js";
import type { SiteRepository } from "./site.repository.js";

/**
 * Orchestration du parc d'immeubles.
 *
 * Le service dépend des **ports**, jamais d'une implémentation (ADR-001), et
 * reçoit toujours le `tenantId` du jeton : aucune méthode ne peut lire ou
 * écrire hors du tenant de l'appelant.
 *
 * Il connaît le port des appareils pour une seule raison : refuser de
 * supprimer un immeuble encore occupé (spec 002, R3).
 */
@Injectable()
export class SitesService {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
  ) {}

  /**
   * Liste filtrée par la règle de recherche du domaine (spec 002, R2).
   *
   * Le filtrage a lieu ici, pas dans le port : voir `site.repository.ts`.
   */
  async list(tenantId: Id, query: string | undefined): Promise<readonly Site[]> {
    const sites = await this.sites.findAll(tenantId);
    if (query === undefined) {
      return sites;
    }
    return sites.filter((site) => siteMatchesQuery(site, query));
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
    const site: Site = {
      id: randomUUID(),
      tenantId,
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
    const updated: Site = {
      ...current,
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.addressLine === undefined ? {} : { addressLine: changes.addressLine }),
      ...(changes.postalCode === undefined ? {} : { postalCode: changes.postalCode }),
      ...(changes.city === undefined ? {} : { city: changes.city }),
    };
    await this.sites.save(updated);
    return updated;
  }

  /**
   * Un immeuble encore équipé n'est pas supprimable (spec 002, R3).
   *
   * Supprimer en cascade détruirait des appareils portant un historique de
   * conformité : dans un produit à valeur probante, la donnée ne disparaît pas
   * par effet de bord.
   */
  async delete(tenantId: Id, id: Id): Promise<void> {
    const attached = (await this.units.findAll(tenantId)).filter((unit) => unit.siteId === id);
    if (attached.length > 0) {
      throw new ConflictException(
        `Ce site porte encore ${attached.length} appareil(s) : supprimez-les d'abord`,
      );
    }
    if (!(await this.sites.deleteById(tenantId, id))) {
      throw new NotFoundException(`Site ${id} introuvable`);
    }
  }
}
