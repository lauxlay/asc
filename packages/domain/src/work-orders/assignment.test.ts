import { describe, expect, it } from "vitest";
import { isoDate } from "../date/iso-date.js";
import { WORK_ORDER_STATUSES, type WorkOrderStatus } from "../entities.js";
import {
  assignmentRefusal,
  isCoherentAssignment,
  isConsistentAssignment,
  isPlanned,
  isUnplanned,
  statusAfterAssignment,
  type WorkOrderAssignment,
} from "./assignment.js";

/** Spec 008, R2 et R4 — affectation au planning. */

const THURSDAY = isoDate("2026-08-13");

const PLANNED: WorkOrderAssignment = { assignee: "user-1", scheduledOn: THURSDAY };
const UNPLANNED: WorkOrderAssignment = { assignee: null, scheduledOn: null };
const ONLY_ASSIGNEE: WorkOrderAssignment = { assignee: "user-1", scheduledOn: null };
const ONLY_DAY: WorkOrderAssignment = { assignee: null, scheduledOn: THURSDAY };

const MIXED: readonly WorkOrderAssignment[] = [ONLY_ASSIGNEE, ONLY_DAY];

describe("isPlanned / isUnplanned / isCoherentAssignment", () => {
  it("reconnaît les deux seuls états valides", () => {
    expect(isPlanned(PLANNED)).toBe(true);
    expect(isUnplanned(UNPLANNED)).toBe(true);
    expect(isCoherentAssignment(PLANNED)).toBe(true);
    expect(isCoherentAssignment(UNPLANNED)).toBe(true);
  });

  it("rejette les combinaisons mixtes", () => {
    for (const mixed of MIXED) {
      expect(isPlanned(mixed)).toBe(false);
      expect(isUnplanned(mixed)).toBe(false);
      expect(isCoherentAssignment(mixed)).toBe(false);
    }
  });
});

describe("assignmentRefusal", () => {
  it("refuse un technicien sans jour et un jour sans technicien", () => {
    for (const mixed of MIXED) {
      for (const status of WORK_ORDER_STATUSES) {
        expect(assignmentRefusal(status, mixed)).toBe("mixed");
      }
    }
  });

  it("accepte de planifier et de déplanifier un OT neuf", () => {
    expect(assignmentRefusal("new", PLANNED)).toBeNull();
    expect(assignmentRefusal("new", UNPLANNED)).toBeNull();
  });

  it("accepte de replanifier et de renvoyer au backlog un OT planifié", () => {
    expect(assignmentRefusal("assigned", PLANNED)).toBeNull();
    expect(assignmentRefusal("assigned", UNPLANNED)).toBeNull();
  });

  it("laisse réaffecter un OT commencé mais pas le désaffecter", () => {
    // Un technicien tombe malade en cours de journée : on réaffecte. Retirer
    // le technicien effacerait qui a fait le travail déjà commencé.
    expect(assignmentRefusal("in_progress", { assignee: "user-2", scheduledOn: THURSDAY })).toBeNull();
    expect(assignmentRefusal("in_progress", UNPLANNED)).toBe("started_unassign");
  });

  it("fige l'affectation d'un OT clôturé ou annulé", () => {
    for (const assignment of [PLANNED, UNPLANNED]) {
      expect(assignmentRefusal("done", assignment)).toBe("terminal");
      expect(assignmentRefusal("cancelled", assignment)).toBe("terminal");
    }
  });

  it("vérifie la cohérence avant le statut", () => {
    // Un OT clôturé et une affectation mixte : c'est la mixité qui est
    // annoncée, parce que c'est elle qu'il faut corriger.
    expect(assignmentRefusal("done", ONLY_DAY)).toBe("mixed");
  });
});

describe("statusAfterAssignment", () => {
  it("fait passer `new` à `assigned` en planifiant", () => {
    expect(statusAfterAssignment("new", PLANNED)).toBe("assigned");
  });

  it("fait repasser `assigned` à `new` en déplanifiant", () => {
    expect(statusAfterAssignment("assigned", UNPLANNED)).toBe("new");
  });

  it("laisse `assigned` en place quand on replanifie", () => {
    expect(statusAfterAssignment("assigned", { assignee: "user-2", scheduledOn: THURSDAY })).toBe(
      "assigned",
    );
  });

  it("ne touche jamais aux statuts de travail et terminaux", () => {
    for (const status of ["in_progress", "done", "cancelled"] as const) {
      expect(statusAfterAssignment(status, PLANNED)).toBe(status);
      expect(statusAfterAssignment(status, UNPLANNED)).toBe(status);
    }
  });

  it("ne produit jamais un état incohérent depuis un état accepté", () => {
    for (const status of WORK_ORDER_STATUSES) {
      for (const assignment of [PLANNED, UNPLANNED]) {
        if (assignmentRefusal(status, assignment) !== null) {
          continue;
        }
        expect(isConsistentAssignment(statusAfterAssignment(status, assignment), assignment)).toBe(
          true,
        );
      }
    }
  });
});

describe("isConsistentAssignment", () => {
  it("impose l'équivalence exacte de `assigned` (R4.3)", () => {
    expect(isConsistentAssignment("assigned", PLANNED)).toBe(true);
    expect(isConsistentAssignment("assigned", UNPLANNED)).toBe(false);
  });

  it("impose qu'un OT `new` soit au backlog", () => {
    expect(isConsistentAssignment("new", UNPLANNED)).toBe(true);
    expect(isConsistentAssignment("new", PLANNED)).toBe(false);
  });

  it("laisse les autres statuts porter ou non une affectation", () => {
    // Un OT peut démarrer sans être passé par le planning, et un OT clôturé
    // garde le technicien qui l'a fait.
    for (const status of ["in_progress", "done", "cancelled"] as const) {
      expect(isConsistentAssignment(status, PLANNED)).toBe(true);
      expect(isConsistentAssignment(status, UNPLANNED)).toBe(true);
    }
  });

  it("ne tolère aucune combinaison mixte, quel que soit le statut", () => {
    for (const status of WORK_ORDER_STATUSES) {
      for (const mixed of MIXED) {
        expect(isConsistentAssignment(status, mixed)).toBe(false);
      }
    }
  });

  it("couvre tous les statuts déclarés", () => {
    // Garde-fou : un statut ajouté sans être pensé ici ferait échouer ce test.
    const covered: readonly WorkOrderStatus[] = ["new", "assigned", "in_progress", "done", "cancelled"];
    expect([...WORK_ORDER_STATUSES]).toStrictEqual([...covered]);
  });
});
