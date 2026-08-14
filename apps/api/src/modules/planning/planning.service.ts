import type { PlanningCard, PlanningQuery, PlanningResponse, PlanningRow } from "@asc/contracts";
import {
  type Id,
  type IsoDate,
  isoDate,
  isTerminalStatus,
  sortByUrgency,
  startOfWeek,
  type User,
  type WorkOrder,
  weekDays,
} from "@asc/domain";
import { Inject, Injectable } from "@nestjs/common";
import {
  SITE_REPOSITORY,
  UNIT_REPOSITORY,
  USER_REPOSITORY,
  WORK_ORDER_REPOSITORY,
} from "../../common/tokens.js";
import type { SiteRepository } from "../sites/site.repository.js";
import type { UnitRepository } from "../units/unit.repository.js";
import type { PersistedUser, UserRepository } from "../users/user.repository.js";
import type { WorkOrderRepository } from "../work-orders/work-order.repository.js";

/**
 * Planning de la semaine (spec 008, R5 et R6).
 *
 * Le service assemble ; il ne calcule ni les jours de la semaine ni l'ordre des
 * cartes — les deux viennent de `@asc/domain`. Sa seule décision propre est la
 * lecture de l'horloge quand aucune semaine n'est demandée : le domaine ne lit
 * jamais l'heure.
 */
@Injectable()
export class PlanningService {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrders: WorkOrderRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
  ) {}

  async week(tenantId: Id, query: PlanningQuery): Promise<PlanningResponse> {
    // Une seule lecture d'horloge : deux appels pourraient tomber de part et
    // d'autre de minuit et rendre une semaine incohérente avec ses jours.
    const reference = query.week ?? today();
    const days = weekDays(reference);
    const inWeek = new Set<string>(days);

    const [workOrders, users, units, sites] = await Promise.all([
      this.workOrders.findAll(tenantId),
      this.users.findAll(tenantId),
      this.units.findAll(tenantId),
      this.sites.findAll(tenantId),
    ]);

    const siteById = new Map(sites.map((site) => [site.id, site]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));
    const toCard = (workOrder: WorkOrder): PlanningCard => {
      const unit = unitById.get(workOrder.unitId);
      const site = unit === undefined ? undefined : siteById.get(unit.siteId);
      return {
        workOrder,
        unitReference: unit?.reference ?? "Appareil inconnu",
        siteId: unit?.siteId ?? "",
        siteName: site?.name ?? "Immeuble inconnu",
      };
    };

    const scheduled = workOrders.filter(
      (workOrder) =>
        workOrder.assignee !== null &&
        workOrder.scheduledOn !== null &&
        inWeek.has(workOrder.scheduledOn),
    );

    return {
      weekStartsOn: startOfWeek(reference),
      days: [...days],
      rows: this.#rowsOf(users, scheduled, toCard),
      // Le backlog ne dépend pas de la semaine : un OT non planifié n'a pas de
      // date, il doit être atteignable depuis n'importe quelle semaine (R6.4).
      // `in_progress` non planifié en fait partie — un OT démarré sans passer
      // par le planning n'apparaîtrait nulle part ailleurs.
      backlog: sortByUrgency(
        workOrders.filter(
          (workOrder) => workOrder.assignee === null && !isTerminalStatus(workOrder.status),
        ),
      ).map(toCard),
    };
  }

  /**
   * Une ligne par utilisateur actif, plus les **désactivés qui portent des OT
   * dans la semaine** (R5.3).
   *
   * Rien ne disparaît en silence : les interventions d'un compte fermé doivent
   * être vues pour être redistribuées.
   */
  #rowsOf(
    users: readonly PersistedUser[],
    scheduled: readonly WorkOrder[],
    toCard: (workOrder: WorkOrder) => PlanningCard,
  ): PlanningRow[] {
    const byAssignee = new Map<string, WorkOrder[]>();
    for (const workOrder of scheduled) {
      if (workOrder.assignee === null) {
        continue;
      }
      const bucket = byAssignee.get(workOrder.assignee);
      if (bucket === undefined) {
        byAssignee.set(workOrder.assignee, [workOrder]);
      } else {
        bucket.push(workOrder);
      }
    }

    return users
      .filter((user) => user.active || byAssignee.has(user.id))
      .map((user) => ({
        user: toPublicUser(user),
        cards: sortByUrgency(byAssignee.get(user.id) ?? []).map(toCard),
      }));
  }
}

/** Le port rend l'enregistrement stocké ; le secret ne sort jamais d'ici. */
function toPublicUser(user: PersistedUser): User {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
  };
}

/** Jour calendaire UTC courant — la seule lecture d'horloge du parcours. */
function today(): IsoDate {
  return isoDate(new Date().toISOString().slice(0, 10));
}
