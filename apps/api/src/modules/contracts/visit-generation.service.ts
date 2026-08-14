import { randomUUID } from "node:crypto";
import type { GenerateVisitsResponse } from "@asc/contracts";
import {
  type Contract,
  type Id,
  type IsoDate,
  isoDate,
  missingVisits,
  scheduleVisits,
  visitKey,
} from "@asc/domain";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { UNIT_REPOSITORY, WORK_ORDER_REPOSITORY } from "../../common/tokens.js";
import type { UnitRepository } from "../units/unit.repository.js";
import type { WorkOrderDraft, WorkOrderRepository } from "../work-orders/work-order.repository.js";

/**
 * Génération des visites périodiques d'un contrat (spec 009).
 *
 * Une visite générée est un **ordre de travail de type `visit`** : c'est ce qui
 * la rend plannifiable par le planning de L1.7 sans redoubler affectation,
 * statuts et fiche.
 *
 * Le service n'invente aucune date — `scheduleVisits` décide — et ne touche à
 * rien d'existant : la génération est purement additive.
 */
@Injectable()
export class VisitGenerationService {
  readonly #logger = new Logger(VisitGenerationService.name);

  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrders: WorkOrderRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
  ) {}

  async generate(contract: Contract): Promise<GenerateVisitsResponse> {
    const generatedOn = today();
    // Un appareil retiré du parc mais resté dans le contrat est ignoré, sans
    // faire échouer le reste (R7.3).
    const known = new Set((await this.units.findAll(contract.tenantId)).map((unit) => unit.id));
    const covered = contract.unitIds.filter((unitId) => known.has(unitId));

    const planned = scheduleVisits({ ...contract, unitIds: covered }, generatedOn);
    const existing = await this.#existingVisitKeys(contract.tenantId);
    const toCreate = missingVisits(planned, existing);

    const now = new Date().toISOString();
    const drafts: WorkOrderDraft[] = toCreate.map((visit) => ({
      id: randomUUID(),
      tenantId: contract.tenantId,
      type: "visit",
      status: "new",
      // Une visite prévue n'est pas une urgence : elle passe après les pannes
      // dans le backlog, ce qui est le bon ordre.
      priority: "normal",
      unitId: visit.unitId,
      summary: "Visite périodique",
      onSiteContact: null,
      followUpOf: null,
      // `reportCount` et `reportedAt` décrivent des signalements, notion qui n'a
      // pas de sens ici : ils gardent une valeur cohérente plutôt qu'un cas
      // particulier dans le modèle.
      reportCount: 1,
      reportedAt: now,
      lastReportedAt: now,
      entrapment: null,
      // La visite attend au backlog : c'est le dispatcher qui la place.
      assignee: null,
      scheduledOn: null,
      dueOn: visit.dueOn,
    }));

    await this.workOrders.createMany(drafts);

    return {
      created: drafts.length,
      alreadyPlanned: planned.length - drafts.length,
      coveredUntil: planned.at(-1)?.dueOn ?? null,
    };
  }

  /**
   * Génération de confort à la création d'un contrat (R4.4).
   *
   * Un échec ne remonte pas : le contrat vient d'être enregistré, et le perdre
   * pour un calendrier manquant serait un mauvais échange. Le dispatcher peut
   * relancer la génération depuis la fiche.
   */
  async generateQuietly(contract: Contract): Promise<void> {
    try {
      await this.generate(contract);
    } catch (error) {
      this.#logger.warn(
        `Visites non générées pour le contrat ${contract.reference} : ${String(error)}`,
      );
    }
  }

  /**
   * Clés (appareil, jour) déjà porteuses d'une visite, **tous statuts
   * confondus** (R3.2).
   *
   * Une visite annulée compte comme couverte : l'annulation est une décision,
   * pas un accident, et la regénérer la défferait.
   */
  async #existingVisitKeys(tenantId: Id): Promise<Set<string>> {
    const workOrders = await this.workOrders.findAll(tenantId);
    return new Set(
      workOrders
        .filter((workOrder) => workOrder.type === "visit" && workOrder.dueOn !== null)
        .map((workOrder) => visitKey(workOrder.unitId, workOrder.dueOn as IsoDate)),
    );
  }
}

/** Jour calendaire UTC courant — la seule lecture d'horloge du parcours. */
function today(): IsoDate {
  return isoDate(new Date().toISOString().slice(0, 10));
}
