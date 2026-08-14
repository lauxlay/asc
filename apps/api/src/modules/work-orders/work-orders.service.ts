import { randomUUID } from "node:crypto";
import type {
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
  WorkOrderChainResponse,
  WorkOrderListQuery,
} from "@asc/contracts";
import {
  allowedTransitionsFrom,
  canTransition,
  followedUpBy,
  followUpChainOf,
  type Id,
  isTerminalStatus,
  type WorkOrder,
  wouldCreateFollowUpCycle,
} from "@asc/domain";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { UNIT_REPOSITORY, WORK_ORDER_REPOSITORY } from "../../common/tokens.js";
import type { UnitRepository } from "../units/unit.repository.js";
import type { WorkOrderDraft, WorkOrderRepository } from "./work-order.repository.js";

/**
 * Orchestration des ordres de travail (spec 007).
 *
 * Le service ne décide d'aucune règle : les transitions et l'acyclicité des
 * chaînes vivent dans `@asc/domain`, la numérotation dans l'adaptateur. Il
 * assemble et traduit les verdicts en réponses HTTP.
 */
@Injectable()
export class WorkOrdersService {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrders: WorkOrderRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
  ) {}

  /** Du plus récent au plus ancien, filtré (spec 007, R9). */
  async list(tenantId: Id, query: WorkOrderListQuery): Promise<readonly WorkOrder[]> {
    const all = await this.workOrders.findAll(tenantId);
    return all.filter(
      (workOrder) =>
        (query.status === undefined || workOrder.status === query.status) &&
        (query.type === undefined || workOrder.type === query.type) &&
        (query.unitId === undefined || workOrder.unitId === query.unitId) &&
        (query.open === undefined || isOpen(workOrder) === (query.open === "true")),
    );
  }

  async getById(tenantId: Id, id: Id): Promise<WorkOrder> {
    const workOrder = await this.workOrders.findById(tenantId, id);
    if (workOrder === null) {
      throw new NotFoundException(`OT ${id} introuvable`);
    }
    return workOrder;
  }

  /**
   * Crée un OT. La référence est attribuée par le port, jamais ici.
   *
   * `reportedAt` est horodaté à cet instant précis : c'est le point de départ
   * du délai de désincarcération, que le produit affichera plus tard.
   */
  async create(tenantId: Id, input: CreateWorkOrderRequest): Promise<WorkOrder> {
    await this.#assertUnitExists(tenantId, input.unitId);

    const id = randomUUID();
    if (input.followUpOf !== null) {
      await this.#assertFollowUpValid(tenantId, id, input.followUpOf);
    }

    const now = new Date().toISOString();
    const draft: WorkOrderDraft = {
      id,
      tenantId,
      type: input.type,
      // Un OT naît toujours `new` : le client ne choisit pas le statut initial.
      status: "new",
      priority: input.priority,
      unitId: input.unitId,
      summary: input.summary,
      onSiteContact: input.onSiteContact,
      followUpOf: input.followUpOf,
      reportCount: 1,
      reportedAt: now,
      lastReportedAt: now,
      // Le script de désincarcération n'a de sens que pour une personne bloquée.
      entrapment: input.priority === "entrapment" ? (input.entrapment ?? emptyEntrapment()) : null,
    };

    return this.workOrders.create(draft);
  }

  /** PATCH : seuls les champs fournis remplacent l'existant. */
  async update(tenantId: Id, id: Id, changes: UpdateWorkOrderRequest): Promise<WorkOrder> {
    const current = await this.getById(tenantId, id);

    if (changes.status !== undefined && changes.status !== current.status) {
      this.#assertTransitionAllowed(current, changes.status);
    }

    const priority = changes.priority ?? current.priority;
    const updated: WorkOrder = {
      ...current,
      ...(changes.status === undefined ? {} : { status: changes.status }),
      ...(changes.summary === undefined ? {} : { summary: changes.summary }),
      ...(changes.onSiteContact === undefined ? {} : { onSiteContact: changes.onSiteContact }),
      priority,
      // Rétrograder la criticité efface le script : il ne décrit plus rien.
      entrapment:
        priority === "entrapment"
          ? (changes.entrapment ?? current.entrapment ?? emptyEntrapment())
          : null,
    };

    await this.workOrders.save(updated);
    return updated;
  }

  /**
   * Rattache un signalement supplémentaire à un OT ouvert (spec 007, R2.3).
   *
   * N'ouvre aucun OT : c'est tout l'intérêt. Le même incident signalé par le
   * gardien puis par trois résidents reste **un** OT, dont le compteur devient
   * un signal de pression pour le dispatcher.
   */
  async attachReport(tenantId: Id, id: Id): Promise<WorkOrder> {
    const current = await this.getById(tenantId, id);

    if (isTerminalStatus(current.status)) {
      throw new UnprocessableEntityException(
        `L'OT ${current.reference} est clôturé : créez un nouvel OT qui prend sa suite`,
      );
    }

    const updated: WorkOrder = {
      ...current,
      reportCount: current.reportCount + 1,
      lastReportedAt: new Date().toISOString(),
    };
    await this.workOrders.save(updated);
    return updated;
  }

  /** Chaîne de l'OT dans les deux sens (spec 007, R5.5). */
  async chainOf(tenantId: Id, id: Id): Promise<WorkOrderChainResponse> {
    const workOrder = await this.getById(tenantId, id);
    const all = await this.workOrders.findAll(tenantId);

    return {
      followUpChain: [...followUpChainOf(workOrder, all)],
      followedUpBy: [...followedUpBy(workOrder, all)],
    };
  }

  async delete(tenantId: Id, id: Id): Promise<void> {
    if (!(await this.workOrders.deleteById(tenantId, id))) {
      throw new NotFoundException(`OT ${id} introuvable`);
    }
  }

  /** L'appareil d'un autre tenant est traité comme inconnu (spec 007, R7.2). */
  async #assertUnitExists(tenantId: Id, unitId: Id): Promise<void> {
    if ((await this.units.findById(tenantId, unitId)) === null) {
      throw new BadRequestException(`Appareil ${unitId} introuvable`);
    }
  }

  async #assertFollowUpValid(tenantId: Id, id: Id, followUpOf: Id): Promise<void> {
    if ((await this.workOrders.findById(tenantId, followUpOf)) === null) {
      throw new BadRequestException(`OT ${followUpOf} introuvable`);
    }
    const all = await this.workOrders.findAll(tenantId);
    if (wouldCreateFollowUpCycle(id, followUpOf, all)) {
      throw new UnprocessableEntityException(
        "Ce chaînage refermerait la chaîne sur elle-même : un OT ne peut pas être sa propre origine",
      );
    }
  }

  /** Le message porte les suites possibles : l'appelant n'a pas à les deviner. */
  #assertTransitionAllowed(current: WorkOrder, next: WorkOrder["status"]): void {
    if (canTransition(current.status, next)) {
      return;
    }
    const allowed = allowedTransitionsFrom(current.status);
    throw new UnprocessableEntityException(
      allowed.length === 0
        ? `L'OT ${current.reference} est ${current.status} : aucune transition n'est possible`
        : `Transition ${current.status} → ${next} impossible. Transitions permises : ${allowed.join(", ")}`,
    );
  }
}

/** Un OT ouvert est celui qui reste à traiter (spec 007, R2.1). */
function isOpen(workOrder: WorkOrder): boolean {
  return !isTerminalStatus(workOrder.status);
}

/** Script ouvert, aucune question encore posée. */
function emptyEntrapment(): WorkOrder["entrapment"] {
  return { medicalEmergency: null, peopleCount: null, betweenFloors: null };
}
