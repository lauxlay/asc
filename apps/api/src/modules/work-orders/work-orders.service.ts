import { randomUUID } from "node:crypto";
import type {
  AssignWorkOrderRequest,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
  WorkOrderChainResponse,
  WorkOrderListQuery,
} from "@asc/contracts";
import {
  type AssignmentRefusal,
  allowedTransitionsFrom,
  assignmentRefusal,
  canTransition,
  followedUpBy,
  followUpChainOf,
  type Id,
  isTerminalStatus,
  statusAfterAssignment,
  type WorkOrder,
  type WorkOrderAssignment,
  wouldCreateFollowUpCycle,
} from "@asc/domain";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { UNIT_REPOSITORY, USER_REPOSITORY, WORK_ORDER_REPOSITORY } from "../../common/tokens.js";
import type { UnitRepository } from "../units/unit.repository.js";
import type { UserRepository } from "../users/user.repository.js";
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
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  /** Du plus récent au plus ancien, filtré (spec 007, R9). */
  async list(tenantId: Id, query: WorkOrderListQuery): Promise<readonly WorkOrder[]> {
    const all = await this.workOrders.findAll(tenantId);
    return all.filter(
      (workOrder) =>
        (query.status === undefined || workOrder.status === query.status) &&
        (query.type === undefined || workOrder.type === query.type) &&
        (query.unitId === undefined || workOrder.unitId === query.unitId) &&
        (query.assignee === undefined || workOrder.assignee === query.assignee) &&
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
      // Un OT naît au backlog : c'est le planning qui l'en sort (spec 008, R6.3).
      assignee: null,
      scheduledOn: null,
    };

    return this.workOrders.create(draft);
  }

  /**
   * Affecte un OT à un technicien pour un jour, ou le renvoie au backlog
   * (spec 008, R2) — c'est le geste du glisser-déposer.
   *
   * Le statut n'est pas fourni par l'appelant : il **découle** de
   * l'affectation. C'est ce qui garantit qu'un OT `assigned` a toujours un
   * technicien et un jour.
   */
  async assign(tenantId: Id, id: Id, input: AssignWorkOrderRequest): Promise<WorkOrder> {
    const current = await this.getById(tenantId, id);
    const assignment: WorkOrderAssignment = {
      assignee: input.assignee,
      scheduledOn: input.scheduledOn,
    };

    const refusal = assignmentRefusal(current.status, assignment);
    if (refusal !== null) {
      throw new UnprocessableEntityException(refusalMessage(refusal, current));
    }

    if (assignment.assignee !== null) {
      await this.#assertAssignable(tenantId, assignment.assignee);
    }

    const updated: WorkOrder = {
      ...current,
      ...assignment,
      status: statusAfterAssignment(current.status, assignment),
    };
    await this.workOrders.save(updated);
    return updated;
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

  /**
   * L'utilisateur doit exister, être **actif**, et appartenir au tenant
   * (spec 008, R8.1).
   *
   * Un utilisateur d'un autre tenant produit exactement la même erreur qu'un
   * identifiant inconnu : aucune réponse ne doit révéler qu'il existe ailleurs.
   */
  async #assertAssignable(tenantId: Id, assignee: Id): Promise<void> {
    const user = await this.users.findById(tenantId, assignee);
    if (user === null) {
      throw new BadRequestException(`Utilisateur ${assignee} introuvable`);
    }
    if (!user.active) {
      throw new BadRequestException(
        `${user.name} est désactivé : réactivez le compte ou choisissez un autre technicien`,
      );
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

/** Message d'un refus d'affectation — le motif vient du domaine, la phrase d'ici. */
function refusalMessage(refusal: AssignmentRefusal, workOrder: WorkOrder): string {
  switch (refusal) {
    case "mixed":
      return "Un OT se planifie avec un technicien et un jour ensemble, ou retourne au backlog sans ni l'un ni l'autre";
    case "terminal":
      return `L'OT ${workOrder.reference} est ${workOrder.status} : son affectation est figée`;
    case "started_unassign":
      return `L'OT ${workOrder.reference} a commencé : il peut être réaffecté, pas renvoyé au backlog`;
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
