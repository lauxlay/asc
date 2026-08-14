import { describe, expect, it } from "vitest";
import type { WorkOrder } from "../entities.js";
import { followedUpBy, followUpChainOf, wouldCreateFollowUpCycle } from "./follow-up.js";

/** Spec 007, R5 — chaînage des ordres de travail. */

function makeWorkOrder(id: string, followUpOf: string | null = null): WorkOrder {
  return {
    id,
    tenantId: "tenant-a",
    reference: `OT-2026-${id.padStart(5, "0")}`,
    type: "breakdown",
    status: "done",
    priority: "normal",
    unitId: "unit-1",
    summary: "Cabine bloquée",
    onSiteContact: null,
    followUpOf,
    reportCount: 1,
    reportedAt: "2026-01-01T09:00:00.000Z",
    lastReportedAt: "2026-01-01T09:00:00.000Z",
    entrapment: null,
  };
}

describe("wouldCreateFollowUpCycle", () => {
  it("laisse passer une absence de chaînage", () => {
    expect(wouldCreateFollowUpCycle("1", null, [])).toBe(false);
  });

  it("laisse passer un chaînage vers un OT indépendant", () => {
    expect(wouldCreateFollowUpCycle("2", "1", [makeWorkOrder("1")])).toBe(false);
  });

  it("refuse un OT qui se référence lui-même", () => {
    expect(wouldCreateFollowUpCycle("1", "1", [makeWorkOrder("1")])).toBe(true);
  });

  it("refuse un cycle direct entre deux OT", () => {
    // 1 suit déjà 2 ; faire suivre 1 par 2 fermerait la boucle.
    const existing = [makeWorkOrder("1", "2"), makeWorkOrder("2")];

    expect(wouldCreateFollowUpCycle("2", "1", existing)).toBe(true);
  });

  it("refuse un cycle indirect", () => {
    const existing = [makeWorkOrder("1", "2"), makeWorkOrder("2", "3"), makeWorkOrder("3")];

    expect(wouldCreateFollowUpCycle("3", "1", existing)).toBe(true);
  });

  it("laisse passer une chaîne longue mais acyclique", () => {
    const existing = [makeWorkOrder("1"), makeWorkOrder("2", "1"), makeWorkOrder("3", "2")];

    expect(wouldCreateFollowUpCycle("4", "3", existing)).toBe(false);
  });

  it("ne boucle pas sur une chaîne déjà corrompue", () => {
    // Sécurité : même si le stock contenait un cycle, la détection termine.
    const existing = [makeWorkOrder("1", "2"), makeWorkOrder("2", "1")];

    expect(wouldCreateFollowUpCycle("3", "1", existing)).toBe(true);
  });

  it("laisse passer un parent introuvable", () => {
    // L'existence du parent est vérifiée ailleurs ; ici on ne juge que le cycle.
    expect(wouldCreateFollowUpCycle("2", "inconnu", [])).toBe(false);
  });
});

describe("followUpChainOf", () => {
  it("rend une chaîne vide pour un OT d'origine", () => {
    const origine = makeWorkOrder("1");

    expect(followUpChainOf(origine, [origine])).toStrictEqual([]);
  });

  it("remonte jusqu'à l'origine, l'OT courant exclu", () => {
    const origine = makeWorkOrder("1");
    const milieu = makeWorkOrder("2", "1");
    const dernier = makeWorkOrder("3", "2");

    expect(followUpChainOf(dernier, [origine, milieu, dernier]).map((w) => w.id)).toStrictEqual([
      "2",
      "1",
    ]);
  });

  it("s'arrête sur un maillon introuvable plutôt que d'échouer", () => {
    const orphelin = makeWorkOrder("2", "disparu");

    expect(followUpChainOf(orphelin, [orphelin])).toStrictEqual([]);
  });

  it("termine même si le stock contient un cycle", () => {
    const a = makeWorkOrder("1", "2");
    const b = makeWorkOrder("2", "1");

    expect(followUpChainOf(a, [a, b]).map((w) => w.id)).toStrictEqual(["2"]);
  });
});

describe("followedUpBy", () => {
  it("rend les OT qui prennent la suite de celui-ci", () => {
    const origine = makeWorkOrder("1");
    const suite = makeWorkOrder("2", "1");
    const autre = makeWorkOrder("3");

    expect(followedUpBy(origine, [origine, suite, autre]).map((w) => w.id)).toStrictEqual(["2"]);
  });

  it("rend une liste vide quand personne ne le suit", () => {
    const seul = makeWorkOrder("1");

    expect(followedUpBy(seul, [seul])).toStrictEqual([]);
  });

  it("rend plusieurs suites quand il y en a plusieurs", () => {
    const origine = makeWorkOrder("1");
    const premiere = makeWorkOrder("2", "1");
    const seconde = makeWorkOrder("3", "1");

    expect(followedUpBy(origine, [origine, premiere, seconde])).toHaveLength(2);
  });
});
