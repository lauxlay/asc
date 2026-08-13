import { randomUUID } from "node:crypto";
import type { CreateUnitRequest, UpdateUnitRequest } from "@asc/contracts";
import type { Id, Unit } from "@asc/domain";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { SITE_REPOSITORY, UNIT_REPOSITORY } from "../../common/tokens.js";
import type { SiteRepository } from "../sites/site.repository.js";
import type { UnitRepository } from "./unit.repository.js";

/**
 * Orchestration du parc d'appareils.
 *
 * Le service dépend des **ports**, jamais d'une implémentation (ADR-001), et
 * reçoit toujours le `tenantId` du jeton : aucune méthode ne peut lire ou
 * écrire hors du tenant de l'appelant.
 */
@Injectable()
export class UnitsService {
  constructor(
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
  ) {}

  /** `siteId` restreint la liste aux appareils d'un immeuble. */
  async list(tenantId: Id, siteId: Id | undefined): Promise<readonly Unit[]> {
    const units = await this.units.findAll(tenantId);
    if (siteId === undefined) {
      return units;
    }
    return units.filter((unit) => unit.siteId === siteId);
  }

  async getById(tenantId: Id, id: Id): Promise<Unit> {
    const unit = await this.units.findById(tenantId, id);
    if (unit === null) {
      throw new NotFoundException(`Appareil ${id} introuvable`);
    }
    return unit;
  }

  /** L'identifiant est un UUID généré par l'application (ADR-001). */
  async create(tenantId: Id, input: CreateUnitRequest): Promise<Unit> {
    await this.#assertSiteExists(tenantId, input.siteId);

    const unit: Unit = {
      id: randomUUID(),
      tenantId,
      siteId: input.siteId,
      reference: input.reference,
      commissionedOn: input.commissionedOn,
      lastStatutoryInspectionOn: input.lastStatutoryInspectionOn,
    };
    await this.units.save(unit);
    return unit;
  }

  /** PATCH : seuls les champs fournis remplacent l'existant. */
  async update(tenantId: Id, id: Id, changes: UpdateUnitRequest): Promise<Unit> {
    const current = await this.getById(tenantId, id);
    if (changes.siteId !== undefined) {
      await this.#assertSiteExists(tenantId, changes.siteId);
    }

    const updated: Unit = {
      ...current,
      ...(changes.siteId === undefined ? {} : { siteId: changes.siteId }),
      ...(changes.reference === undefined ? {} : { reference: changes.reference }),
      ...(changes.commissionedOn === undefined ? {} : { commissionedOn: changes.commissionedOn }),
      ...(changes.lastStatutoryInspectionOn === undefined
        ? {}
        : { lastStatutoryInspectionOn: changes.lastStatutoryInspectionOn }),
    };
    await this.units.save(updated);
    return updated;
  }

  async delete(tenantId: Id, id: Id): Promise<void> {
    if (!(await this.units.deleteById(tenantId, id))) {
      throw new NotFoundException(`Appareil ${id} introuvable`);
    }
  }

  /**
   * Un appareil est toujours rattaché à un immeuble existant (spec 002, R1).
   *
   * Le site d'un autre tenant est traité comme inconnu — même code, même
   * message : un écart révélerait l'existence de la donnée d'autrui.
   */
  async #assertSiteExists(tenantId: Id, siteId: Id): Promise<void> {
    if ((await this.sites.findById(tenantId, siteId)) === null) {
      throw new BadRequestException(`Site ${siteId} introuvable`);
    }
  }
}
