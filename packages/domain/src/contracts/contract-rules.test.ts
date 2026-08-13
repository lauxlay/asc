import { describe, expect, it } from "vitest";
import { isoDate } from "../date/iso-date.js";
import type { Contract } from "../entities.js";
import {
  conflictingUnitIds,
  duplicatedUnitIds,
  hasLegalDuration,
  isActiveOn,
  periodsOverlap,
} from "./contract-rules.js";

/** Spec 005, R2 et R3 — durée légale et couverture exclusive. */

function period(startsOn: string, endsOn: string | null) {
  return { startsOn: isoDate(startsOn), endsOn: endsOn === null ? null : isoDate(endsOn) };
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    tenantId: "tenant-a",
    reference: "CT-2026-001",
    type: "minimal",
    unitIds: ["unit-1"],
    startsOn: isoDate("2026-01-01"),
    endsOn: null,
    ...overrides,
  };
}

/** R2 — durée minimale d'un an (loi SAE 2003). */
describe("hasLegalDuration", () => {
  it("accepte un contrat d'exactement un an, borne incluse", () => {
    expect(hasLegalDuration(period("2026-01-01", "2027-01-01"))).toBe(true);
  });

  it("refuse un jour de moins qu'un an", () => {
    expect(hasLegalDuration(period("2026-01-01", "2026-12-31"))).toBe(false);
  });

  it("accepte plus d'un an", () => {
    expect(hasLegalDuration(period("2026-01-01", "2029-06-30"))).toBe(true);
  });

  it("accepte une période sans terme : elle est ouverte", () => {
    expect(hasLegalDuration(period("2026-01-01", null))).toBe(true);
  });

  it("refuse une fin antérieure au début", () => {
    expect(hasLegalDuration(period("2026-06-01", "2026-01-01"))).toBe(false);
  });

  it("gère le 29 février, écrêté au 28", () => {
    // `addYears` écrête à la fin du mois : 2024-02-29 + 1 an = 2025-02-28.
    expect(hasLegalDuration(period("2024-02-29", "2025-02-28"))).toBe(true);
    expect(hasLegalDuration(period("2024-02-29", "2025-02-27"))).toBe(false);
  });
});

/** R3.3 et R3.4 — chevauchement de périodes. */
describe("periodsOverlap", () => {
  it("détecte deux périodes identiques", () => {
    expect(
      periodsOverlap(period("2026-01-01", "2027-01-01"), period("2026-01-01", "2027-01-01")),
    ).toBe(true);
  });

  it("détecte un recouvrement partiel", () => {
    expect(
      periodsOverlap(period("2026-01-01", "2027-01-01"), period("2026-06-01", "2027-06-01")),
    ).toBe(true);
  });

  it("détecte un recouvrement d'un seul jour", () => {
    expect(
      periodsOverlap(period("2026-01-01", "2027-01-01"), period("2027-01-01", "2028-01-01")),
    ).toBe(true);
  });

  it("laisse passer deux contrats successifs", () => {
    expect(
      periodsOverlap(period("2024-01-01", "2025-01-01"), period("2025-01-02", "2026-01-02")),
    ).toBe(false);
  });

  it("est symétrique", () => {
    const left = period("2024-01-01", "2025-01-01");
    const right = period("2025-01-02", null);

    expect(periodsOverlap(left, right)).toBe(periodsOverlap(right, left));
  });

  it("fait toujours se chevaucher deux périodes ouvertes", () => {
    expect(periodsOverlap(period("2020-01-01", null), period("2030-01-01", null))).toBe(true);
  });

  it("détecte qu'une période ouverte recouvre toute période postérieure", () => {
    expect(periodsOverlap(period("2020-01-01", null), period("2026-01-01", "2027-01-01"))).toBe(
      true,
    );
  });

  it("laisse passer une période close avant l'ouverture d'une période ouverte", () => {
    expect(periodsOverlap(period("2020-01-01", "2021-01-01"), period("2026-01-01", null))).toBe(
      false,
    );
  });
});

describe("conflictingUnitIds", () => {
  it("ne signale rien quand aucun contrat n'existe", () => {
    expect(
      conflictingUnitIds({ ...period("2026-01-01", null), unitIds: ["unit-1"] }, []),
    ).toStrictEqual([]);
  });

  it("signale un appareil déjà couvert sur une période qui se chevauche", () => {
    const existing = makeContract({ unitIds: ["unit-1", "unit-2"] });

    expect(
      conflictingUnitIds({ ...period("2026-06-01", null), unitIds: ["unit-2"] }, [existing]),
    ).toStrictEqual(["unit-2"]);
  });

  it("ne signale rien pour un contrat successif", () => {
    const existing = makeContract({ ...period("2024-01-01", "2025-01-01") });

    expect(
      conflictingUnitIds({ ...period("2025-01-02", null), unitIds: ["unit-1"] }, [existing]),
    ).toStrictEqual([]);
  });

  it("ne signale que les appareils réellement en conflit", () => {
    const existing = makeContract({ unitIds: ["unit-1"] });

    expect(
      conflictingUnitIds({ ...period("2026-01-01", null), unitIds: ["unit-1", "unit-9"] }, [
        existing,
      ]),
    ).toStrictEqual(["unit-1"]);
  });

  it("ne rend pas deux fois le même appareil", () => {
    const first = makeContract({ id: "c-1", unitIds: ["unit-1"] });
    const second = makeContract({ id: "c-2", unitIds: ["unit-1"] });

    expect(
      conflictingUnitIds({ ...period("2026-01-01", null), unitIds: ["unit-1"] }, [first, second]),
    ).toStrictEqual(["unit-1"]);
  });

  it("préserve l'ordre des appareils du candidat", () => {
    const existing = makeContract({ unitIds: ["unit-3", "unit-1"] });

    expect(
      conflictingUnitIds({ ...period("2026-01-01", null), unitIds: ["unit-1", "unit-3"] }, [
        existing,
      ]),
    ).toStrictEqual(["unit-1", "unit-3"]);
  });

  it("ignore les contrats dont la période ne chevauche pas", () => {
    const ancien = makeContract({ ...period("2000-01-01", "2001-01-01"), unitIds: ["unit-1"] });

    expect(
      conflictingUnitIds({ ...period("2026-01-01", null), unitIds: ["unit-1"] }, [ancien]),
    ).toStrictEqual([]);
  });
});

describe("duplicatedUnitIds", () => {
  it("ne signale rien sans doublon", () => {
    expect(duplicatedUnitIds(["unit-1", "unit-2"])).toStrictEqual([]);
  });

  it("signale un appareil cité deux fois", () => {
    expect(duplicatedUnitIds(["unit-1", "unit-2", "unit-1"])).toStrictEqual(["unit-1"]);
  });

  it("ne signale qu'une fois un appareil cité trois fois", () => {
    expect(duplicatedUnitIds(["unit-1", "unit-1", "unit-1"])).toStrictEqual(["unit-1"]);
  });

  it("accepte une liste vide", () => {
    expect(duplicatedUnitIds([])).toStrictEqual([]);
  });
});

describe("isActiveOn", () => {
  it("est actif le jour de la prise d'effet", () => {
    expect(isActiveOn(period("2026-01-01", "2027-01-01"), isoDate("2026-01-01"))).toBe(true);
  });

  it("est actif le dernier jour, borne incluse", () => {
    expect(isActiveOn(period("2026-01-01", "2027-01-01"), isoDate("2027-01-01"))).toBe(true);
  });

  it("n'est pas actif la veille de la prise d'effet", () => {
    expect(isActiveOn(period("2026-01-01", "2027-01-01"), isoDate("2025-12-31"))).toBe(false);
  });

  it("n'est plus actif le lendemain du terme", () => {
    expect(isActiveOn(period("2026-01-01", "2027-01-01"), isoDate("2027-01-02"))).toBe(false);
  });

  it("reste actif indéfiniment sans terme", () => {
    expect(isActiveOn(period("2026-01-01", null), isoDate("2099-01-01"))).toBe(true);
  });
});
