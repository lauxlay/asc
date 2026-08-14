import { describe, expect, it } from "vitest";
import { WORK_ORDER_STATUSES, type WorkOrderStatus } from "../entities.js";
import {
  allowedTransitionsFrom,
  canTransition,
  formatWorkOrderReference,
  isTerminalStatus,
} from "./status-transitions.js";

/** Spec 007, R3 — cycle de vie d'un ordre de travail. */

/** Toutes les paires de statuts, pour n'en oublier aucune. */
const ALL_PAIRS: readonly (readonly [WorkOrderStatus, WorkOrderStatus])[] =
  WORK_ORDER_STATUSES.flatMap((from) => WORK_ORDER_STATUSES.map((to) => [from, to] as const));

/** Les seules transitions permises ; tout le reste doit être refusé. */
const PERMITTED: readonly string[] = [
  "new→in_progress",
  "new→cancelled",
  "in_progress→done",
  "in_progress→cancelled",
];

describe("canTransition", () => {
  it.each(ALL_PAIRS)("%s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(PERMITTED.includes(`${from}→${to}`));
  });

  it("refuse de rester sur place", () => {
    for (const status of WORK_ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("mène une panne de bout en bout", () => {
    expect(canTransition("new", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "done")).toBe(true);
  });

  it("ne laisse jamais rouvrir un OT clôturé", () => {
    for (const to of WORK_ORDER_STATUSES) {
      expect(canTransition("done", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });

  it("permet d'annuler avant et pendant, jamais après", () => {
    expect(canTransition("new", "cancelled")).toBe(true);
    expect(canTransition("in_progress", "cancelled")).toBe(true);
    expect(canTransition("done", "cancelled")).toBe(false);
  });

  it("ne saute pas l'intervention", () => {
    // Un OT ne peut pas être fait sans avoir commencé.
    expect(canTransition("new", "done")).toBe(false);
  });
});

describe("allowedTransitionsFrom", () => {
  it("rend les suites possibles d'un OT neuf", () => {
    expect(allowedTransitionsFrom("new")).toStrictEqual(["in_progress", "cancelled"]);
  });

  it("rend les suites possibles d'un OT en cours", () => {
    expect(allowedTransitionsFrom("in_progress")).toStrictEqual(["done", "cancelled"]);
  });

  it("ne rend rien depuis un statut terminal", () => {
    expect(allowedTransitionsFrom("done")).toStrictEqual([]);
    expect(allowedTransitionsFrom("cancelled")).toStrictEqual([]);
  });

  it("reste cohérente avec canTransition", () => {
    for (const [from, to] of ALL_PAIRS) {
      expect(allowedTransitionsFrom(from).includes(to)).toBe(canTransition(from, to));
    }
  });
});

describe("formatWorkOrderReference", () => {
  it.each([
    [2026, 1, "OT-2026-00001"],
    [2026, 42, "OT-2026-00042"],
    [2026, 99_999, "OT-2026-99999"],
  ])("année %s rang %s → %s", (year, sequence, expected) => {
    expect(formatWorkOrderReference(year, sequence)).toBe(expected);
  });

  it("ne tronque pas au-delà de cinq chiffres", () => {
    expect(formatWorkOrderReference(2026, 100_000)).toBe("OT-2026-100000");
  });

  it("garde l'ordre lexicographique aligné sur l'ordre chronologique", () => {
    // C'est ce qui permet de trier des références sans les reparser.
    expect(formatWorkOrderReference(2026, 9) < formatWorkOrderReference(2026, 10)).toBe(true);
    expect(formatWorkOrderReference(2026, 99_999) < formatWorkOrderReference(2027, 1)).toBe(true);
  });

  it("distingue deux rangs identiques d'années différentes", () => {
    // La remise à zéro annuelle ne doit jamais produire deux fois le même
    // numéro (spec 007, R6.3).
    expect(formatWorkOrderReference(2026, 42)).not.toBe(formatWorkOrderReference(2027, 42));
  });
});

describe("isTerminalStatus", () => {
  it.each([
    ["new", false],
    ["in_progress", false],
    ["done", true],
    ["cancelled", true],
  ] as const)("%s terminal : %s", (status, terminal) => {
    expect(isTerminalStatus(status)).toBe(terminal);
  });
});
