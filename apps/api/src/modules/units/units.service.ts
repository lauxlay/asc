import { randomUUID } from "node:crypto";
import type { CreateUnitRequest, UpdateUnitRequest } from "@asc/contracts";
import type { Id, Unit } from "@asc/domain";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { UNIT_REPOSITORY } from "../../common/tokens.js";
import type { UnitRepository } from "./unit.repository.js";

/**
 * Orchestration du parc d'appareils.
 *
 * Le service dépend du **port** `UnitRepository`, jamais d'une implémentation
 * (ADR-001), et reçoit toujours le `tenantId` du jeton : aucune méthode ne
 * peut lire ou écrire hors du tenant de l'appelant.
 */
@Injectable()
export class UnitsService {
  constructor(@Inject(UNIT_REPOSITORY) private readonly units: UnitRepository) {}

  async list(tenantId: Id): Promise<readonly Unit[]> {
    return this.units.findAll(tenantId);
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
    const unit: Unit = {
      id: randomUUID(),
      tenantId,
      siteId: input.siteId,
      commissionedOn: input.commissionedOn,
      lastStatutoryInspectionOn: input.lastStatutoryInspectionOn,
    };
    await this.units.save(unit);
    return unit;
  }

  /** PATCH : seuls les champs fournis remplacent l'existant. */
  async update(tenantId: Id, id: Id, changes: UpdateUnitRequest): Promise<Unit> {
    const current = await this.getById(tenantId, id);
    const updated: Unit = {
      ...current,
      ...(changes.siteId === undefined ? {} : { siteId: changes.siteId }),
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
}
