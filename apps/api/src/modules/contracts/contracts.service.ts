import { randomUUID } from "node:crypto";
import type {
  ComplianceDeadlineListResponse,
  CreateContractRequest,
  GenerateVisitsResponse,
  UpdateContractRequest,
} from "@asc/contracts";
import {
  type Contract,
  computeDeadlines,
  conflictingUnitIds,
  duplicatedUnitIds,
  hasLegalDuration,
  type Id,
  type IsoDate,
  isoDate,
  MINIMUM_CONTRACT_YEARS,
} from "@asc/domain";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { CONTRACT_REPOSITORY, SITE_REPOSITORY, UNIT_REPOSITORY } from "../../common/tokens.js";
import type { SiteRepository } from "../sites/site.repository.js";
import type { UnitRepository } from "../units/unit.repository.js";
import type { ContractRepository } from "./contract.repository.js";
import { VisitGenerationService } from "./visit-generation.service.js";

/**
 * Orchestration des contrats d'entretien (spec 005).
 *
 * C'est ce service qui branche enfin le moteur d'échéances écrit au lot L0.2 :
 * il rassemble l'appareil, son contrat et ses visites, et laisse
 * `computeDeadlines` décider. Aucune règle de date n'est recalculée ici.
 */
@Injectable()
export class ContractsService {
  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(VisitGenerationService) private readonly visits: VisitGenerationService,
  ) {}

  /** Génération à la demande, depuis la fiche du contrat (spec 009, R4.2). */
  async generateVisits(tenantId: Id, id: Id): Promise<GenerateVisitsResponse> {
    return this.visits.generate(await this.getById(tenantId, id));
  }

  /** `unitId` restreint la liste aux contrats couvrant un appareil. */
  async list(tenantId: Id, unitId: Id | undefined): Promise<readonly Contract[]> {
    const contracts = await this.contracts.findAll(tenantId);
    if (unitId === undefined) {
      return contracts;
    }
    return contracts.filter((contract) => contract.unitIds.includes(unitId));
  }

  async getById(tenantId: Id, id: Id): Promise<Contract> {
    const contract = await this.contracts.findById(tenantId, id);
    if (contract === null) {
      throw new NotFoundException(`Contrat ${id} introuvable`);
    }
    return contract;
  }

  /** L'identifiant est un UUID généré par l'application (ADR-001). */
  async create(tenantId: Id, input: CreateContractRequest): Promise<Contract> {
    const contract: Contract = {
      id: randomUUID(),
      tenantId,
      reference: input.reference,
      type: input.type,
      unitIds: input.unitIds,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
    };
    await this.#assertValid(tenantId, contract);
    await this.contracts.save(contract);
    // Promesse d'onboarding : signer un client et voir son planning se remplir
    // le jour même (spec 009, R4.1). Sans effet de bord en cas d'échec.
    await this.visits.generateQuietly(contract);
    return contract;
  }

  /** PATCH : seuls les champs fournis remplacent l'existant. */
  async update(tenantId: Id, id: Id, changes: UpdateContractRequest): Promise<Contract> {
    const current = await this.getById(tenantId, id);
    const updated: Contract = {
      ...current,
      ...(changes.reference === undefined ? {} : { reference: changes.reference }),
      ...(changes.type === undefined ? {} : { type: changes.type }),
      ...(changes.unitIds === undefined ? {} : { unitIds: changes.unitIds }),
      ...(changes.startsOn === undefined ? {} : { startsOn: changes.startsOn }),
      ...(changes.endsOn === undefined ? {} : { endsOn: changes.endsOn }),
    };
    await this.#assertValid(tenantId, updated);
    await this.contracts.save(updated);

    // Un appareil rejoint le contrat : ses visites suivent (spec 009, R4.1).
    // Sans ça, la promesse d'onboarding ne tiendrait pas à l'écran — le
    // formulaire de création ne demande pas les appareils, ils sont liés
    // ensuite. La génération étant idempotente, régénérer ne coûte rien.
    if (changes.unitIds !== undefined) {
      await this.visits.generateQuietly(updated);
    }
    return updated;
  }

  async delete(tenantId: Id, id: Id): Promise<void> {
    if (!(await this.contracts.deleteById(tenantId, id))) {
      throw new NotFoundException(`Contrat ${id} introuvable`);
    }
  }

  /**
   * Échéances des appareils couverts par le contrat (spec 005, R4).
   *
   * Calculées à la demande, jamais stockées. Le « aujourd'hui » est fourni ici,
   * à la frontière : le domaine ne lit pas d'horloge (spec 001, R6).
   *
   * Aucune visite n'est encore persistée (collection absente avant L1.6) : le
   * compteur part donc de `contract.startsOn`, ce qui est exactement la règle
   * R1.3 de la spec 001.
   */
  async deadlinesOf(tenantId: Id, id: Id): Promise<ComplianceDeadlineListResponse> {
    const contract = await this.getById(tenantId, id);
    const evaluatedOn = today();

    const [allUnits, allSites] = await Promise.all([
      this.units.findAll(tenantId),
      this.sites.findAll(tenantId),
    ]);
    const siteById = new Map(allSites.map((site) => [site.id, site]));

    const items = contract.unitIds.flatMap((unitId) => {
      const unit = allUnits.find((candidate) => candidate.id === unitId);
      if (unit === undefined) {
        return [];
      }
      return computeDeadlines(unit, contract, [], evaluatedOn).map((deadline) => ({
        unitId: deadline.unitId,
        unitReference: unit.reference,
        siteName: siteById.get(unit.siteId)?.name ?? "Immeuble inconnu",
        kind: deadline.kind,
        dueOn: deadline.dueOn,
        status: deadline.status,
      }));
    });

    return { evaluatedOn, items };
  }

  /**
   * Valide un contrat complet — durée légale et couverture exclusive.
   *
   * Les règles vivent dans `@asc/domain` ; ce service ne fait que les appeler
   * et traduire leur verdict en réponse HTTP.
   */
  async #assertValid(tenantId: Id, contract: Contract): Promise<void> {
    if (!hasLegalDuration(contract)) {
      throw new UnprocessableEntityException(
        `Un contrat d'entretien dure au minimum ${MINIMUM_CONTRACT_YEARS} an (loi SAE 2003)`,
      );
    }

    const duplicated = duplicatedUnitIds(contract.unitIds);
    if (duplicated.length > 0) {
      throw new BadRequestException(
        `Appareil(s) cité(s) plusieurs fois dans le contrat : ${duplicated.join(", ")}`,
      );
    }

    for (const unitId of contract.unitIds) {
      if ((await this.units.findById(tenantId, unitId)) === null) {
        throw new BadRequestException(`Appareil ${unitId} introuvable`);
      }
    }

    // Le contrat en cours de modification ne se fait pas concurrence à lui-même.
    const others = (await this.contracts.findAll(tenantId)).filter(
      (candidate) => candidate.id !== contract.id,
    );
    const conflicts = conflictingUnitIds(contract, others);
    if (conflicts.length > 0) {
      throw new ConflictException(
        `Appareil(s) déjà couvert(s) par un autre contrat sur cette période : ${conflicts.join(", ")}`,
      );
    }
  }
}

/** Jour calendaire UTC courant — la seule lecture d'horloge du parcours. */
function today(): IsoDate {
  return isoDate(new Date().toISOString().slice(0, 10));
}
