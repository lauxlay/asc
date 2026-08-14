import { describe, expect, it } from "vitest";
import { WORK_ORDER_PRIORITIES } from "../entities.js";
import { compareByUrgency, type DispatchOrdered, sortByUrgency } from "./dispatch-order.js";

/** Spec 008, R5.4 et R6.1 — le plus critique d'abord, puis le plus ancien. */

interface Card extends DispatchOrdered {
  readonly reference: string;
}

function card(reference: string, priority: Card["priority"], reportedAt: string): Card {
  return { reference, priority, reportedAt };
}

const MORNING = "2026-08-13T08:00:00.000Z";
const NOON = "2026-08-13T12:00:00.000Z";
const EVENING = "2026-08-13T18:00:00.000Z";

describe("compareByUrgency", () => {
  it("place une désincarcération devant tout le reste", () => {
    // Même signalée bien plus tard qu'une panne ordinaire.
    const entrapment = card("OT-2026-00002", "entrapment", EVENING);
    const normal = card("OT-2026-00001", "normal", MORNING);

    expect(compareByUrgency(entrapment, normal)).toBeLessThan(0);
  });

  it("respecte l'ordre déclaré des criticités", () => {
    expect(compareByUrgency(card("a", "entrapment", NOON), card("b", "urgent", NOON))).toBeLessThan(
      0,
    );
    expect(compareByUrgency(card("a", "urgent", NOON), card("b", "normal", NOON))).toBeLessThan(0);
  });

  it("à criticité égale, le plus ancien passe devant", () => {
    expect(compareByUrgency(card("a", "urgent", MORNING), card("b", "urgent", NOON))).toBeLessThan(
      0,
    );
  });

  it("rend zéro sur deux cartes identiques", () => {
    expect(compareByUrgency(card("a", "normal", NOON), card("b", "normal", NOON))).toBe(0);
  });

  describe("échéance réglementaire", () => {
    /** Les visites générées naissent toutes au même instant (spec 009). */
    const visit = (reference: string, dueOn: string) => ({
      ...card(reference, "normal" as const, NOON),
      dueOn,
    });

    it("départage deux visites nées au même instant", () => {
      expect(
        compareByUrgency(visit("proche", "2026-09-03"), visit("lointaine", "2027-07-15")),
      ).toBeLessThan(0);
    });

    it("place une carte sans échéance devant une carte qui en a une", () => {
      // Une panne n'a pas de date limite parce qu'elle est due maintenant.
      expect(
        compareByUrgency(card("panne", "normal", NOON), visit("visite", "2026-09-03")),
      ).toBeLessThan(0);
    });

    it("ne passe jamais avant la criticité", () => {
      const entrapment = { ...card("bloqué", "entrapment", NOON), dueOn: "2030-01-01" };

      expect(compareByUrgency(entrapment, visit("visite", "2026-09-03"))).toBeLessThan(0);
    });

    it("laisse l'ancienneté départager à échéance égale", () => {
      expect(
        compareByUrgency(visit("ancienne", "2026-09-03"), {
          ...visit("récente", "2026-09-03"),
          reportedAt: EVENING,
        }),
      ).toBeLessThan(0);
    });

    it("ordonne un backlog mêlant pannes et visites", () => {
      const sorted = sortByUrgency([
        visit("visite-lointaine", "2027-07-15"),
        card("panne-recente", "normal", EVENING),
        visit("visite-proche", "2026-09-03"),
        card("panne-ancienne", "normal", MORNING),
      ]);

      expect(sorted.map((entry) => entry.reference)).toStrictEqual([
        "panne-ancienne",
        "panne-recente",
        "visite-proche",
        "visite-lointaine",
      ]);
    });
  });
});

describe("sortByUrgency", () => {
  it("ordonne une file de dispatch réelle", () => {
    const sorted = sortByUrgency([
      card("OT-2026-00001", "normal", MORNING),
      card("OT-2026-00002", "urgent", EVENING),
      card("OT-2026-00003", "entrapment", EVENING),
      card("OT-2026-00004", "urgent", MORNING),
      card("OT-2026-00005", "normal", NOON),
    ]);

    expect(sorted.map((entry) => entry.reference)).toStrictEqual([
      "OT-2026-00003",
      "OT-2026-00004",
      "OT-2026-00002",
      "OT-2026-00001",
      "OT-2026-00005",
    ]);
  });

  it("ne modifie pas la liste reçue", () => {
    const input = [card("a", "normal", NOON), card("b", "entrapment", NOON)];
    sortByUrgency(input);

    expect(input.map((entry) => entry.reference)).toStrictEqual(["a", "b"]);
  });

  it("conserve l'ordre d'entrée à criticité et instant identiques", () => {
    const sorted = sortByUrgency([
      card("a", "urgent", NOON),
      card("b", "urgent", NOON),
      card("c", "urgent", NOON),
    ]);

    expect(sorted.map((entry) => entry.reference)).toStrictEqual(["a", "b", "c"]);
  });

  it("couvre toutes les criticités déclarées", () => {
    // Garde-fou : une criticité ajoutée sans rang défini remonterait ici.
    const sorted = sortByUrgency(
      [...WORK_ORDER_PRIORITIES].reverse().map((priority) => card(priority, priority, NOON)),
    );

    expect(sorted.map((entry) => entry.reference)).toStrictEqual([...WORK_ORDER_PRIORITIES]);
  });

  it("rend une liste vide sans broncher", () => {
    expect(sortByUrgency([])).toStrictEqual([]);
  });
});
