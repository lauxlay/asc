import { describe, expect, it } from "vitest";
import { isoDate } from "../date/iso-date.js";
import type { Contract, MaintenanceVisit, Unit } from "../entities.js";
import { DomainError } from "../errors.js";
import {
  type ComplianceDeadline,
  computeDeadlines,
  type DeadlineKind,
  INSPECTION_ALERT_MONTHS,
  INSPECTION_INTERVAL_YEARS,
  VISIT_ALERT_DAYS,
  VISIT_INTERVAL_WEEKS,
} from "./deadlines.js";

const TENANT = "tenant-1";
const UNIT_ID = "unit-1";

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: UNIT_ID,
    tenantId: TENANT,
    siteId: "site-1",
    reference: "Ascenseur A",
    commissionedOn: null,
    lastStatutoryInspectionOn: null,
    ...overrides,
  };
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    tenantId: TENANT,
    type: "minimal",
    unitIds: [UNIT_ID],
    startsOn: isoDate("2026-01-01"),
    endsOn: null,
    ...overrides,
  };
}

function completedVisit(on: string, overrides: Partial<MaintenanceVisit> = {}): MaintenanceVisit {
  return {
    id: `visit-${on}`,
    tenantId: TENANT,
    unitId: UNIT_ID,
    completedOn: isoDate(on),
    ...overrides,
  };
}

function find(deadlines: readonly ComplianceDeadline[], kind: DeadlineKind): ComplianceDeadline {
  const found = deadlines.find((deadline) => deadline.kind === kind);
  if (found === undefined) {
    throw new Error(`Échéance ${kind} absente du résultat`);
  }
  return found;
}

describe("constantes réglementaires", () => {
  it("encode les règles françaises", () => {
    expect(VISIT_INTERVAL_WEEKS).toBe(6);
    expect(INSPECTION_INTERVAL_YEARS).toBe(5);
    expect(INSPECTION_ALERT_MONTHS).toBe(6);
    expect(VISIT_ALERT_DAYS).toBe(7);
  });
});

describe("R1 — échéance de visite (visit_6w)", () => {
  it("part du début du contrat quand aucune visite n'a été réalisée", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract({ startsOn: isoDate("2026-01-01") }),
      [],
      isoDate("2026-01-15"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2026-02-12");
  });

  it("part de la dernière visite réalisée", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10")],
      isoDate("2026-03-15"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2026-04-21");
  });

  it("retient la visite la plus récente quel que soit l'ordre d'entrée", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10"), completedVisit("2026-01-20"), completedVisit("2026-02-14")],
      isoDate("2026-03-15"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2026-04-21");
  });

  it("ignore les visites planifiées non réalisées", () => {
    const planned: MaintenanceVisit = {
      id: "visit-planned",
      tenantId: TENANT,
      unitId: UNIT_ID,
      completedOn: null,
    };
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10"), planned],
      isoDate("2026-03-15"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2026-04-21");
  });

  it("ignore une visite datée après la date de référence", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10"), completedVisit("2026-06-01")],
      isoDate("2026-03-15"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2026-04-21");
  });

  it("compte une visite réalisée le jour même de la référence", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-15")],
      isoDate("2026-03-15"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2026-04-26");
  });

  it("franchit correctement une fin d'année bissextile", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract({ startsOn: isoDate("2023-12-31") }),
      [completedVisit("2024-01-31")],
      isoDate("2024-02-01"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2024-03-13");
  });

  it("ne dépend pas du type de contrat", () => {
    const visits = [completedVisit("2026-03-10")];
    const minimal = computeDeadlines(
      makeUnit(),
      makeContract({ type: "minimal" }),
      visits,
      isoDate("2026-03-15"),
    );
    const extended = computeDeadlines(
      makeUnit(),
      makeContract({ type: "extended" }),
      visits,
      isoDate("2026-03-15"),
    );

    expect(minimal).toStrictEqual(extended);
  });
});

describe("R1.1 — couverture contractuelle", () => {
  it("ne produit aucune échéance de visite sans contrat", () => {
    const deadlines = computeDeadlines(makeUnit(), null, [], isoDate("2026-03-15"));

    expect(deadlines).toStrictEqual([]);
  });

  it("ne produit aucune échéance de visite si le contrat ne liste pas l'appareil", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract({ unitIds: ["unit-2", "unit-3"] }),
      [],
      isoDate("2026-03-15"),
    );

    expect(deadlines).toStrictEqual([]);
  });

  it("ne produit aucune échéance de visite avant le début du contrat", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract({ startsOn: isoDate("2026-04-01") }),
      [],
      isoDate("2026-03-31"),
    );

    expect(deadlines).toStrictEqual([]);
  });

  it("ne produit aucune échéance de visite après la fin du contrat", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract({ endsOn: isoDate("2026-03-31") }),
      [],
      isoDate("2026-04-01"),
    );

    expect(deadlines).toStrictEqual([]);
  });

  it("couvre le premier jour du contrat (borne incluse)", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract({ startsOn: isoDate("2026-04-01") }),
      [],
      isoDate("2026-04-01"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2026-05-13");
  });

  it("couvre le dernier jour du contrat (borne incluse)", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract({ endsOn: isoDate("2026-03-31") }),
      [],
      isoDate("2026-03-31"),
    );

    expect(find(deadlines, "visit_6w").kind).toBe("visit_6w");
  });

  it("couvre un contrat en tacite reconduction (endsOn null)", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract({ startsOn: isoDate("2020-01-01"), endsOn: null }),
      [completedVisit("2026-08-01")],
      isoDate("2026-08-12"),
    );

    expect(find(deadlines, "visit_6w").dueOn).toBe("2026-09-12");
  });
});

describe("R2 — échéance quinquennale (inspection_5y)", () => {
  it("part du dernier contrôle réalisé", () => {
    const deadlines = computeDeadlines(
      makeUnit({ lastStatutoryInspectionOn: isoDate("2023-06-15") }),
      null,
      [],
      isoDate("2026-08-12"),
    );

    expect(find(deadlines, "inspection_5y").dueOn).toBe("2028-06-15");
  });

  it("part de la mise en service quand aucun contrôle n'est connu", () => {
    const deadlines = computeDeadlines(
      makeUnit({ commissionedOn: isoDate("2024-02-29") }),
      null,
      [],
      isoDate("2026-08-12"),
    );

    expect(find(deadlines, "inspection_5y").dueOn).toBe("2029-02-28");
  });

  it("préfère le dernier contrôle à la mise en service", () => {
    const deadlines = computeDeadlines(
      makeUnit({
        commissionedOn: isoDate("2010-01-01"),
        lastStatutoryInspectionOn: isoDate("2023-06-15"),
      }),
      null,
      [],
      isoDate("2026-08-12"),
    );

    expect(find(deadlines, "inspection_5y").dueOn).toBe("2028-06-15");
  });

  it("ne produit rien quand ni contrôle ni mise en service ne sont connus", () => {
    const deadlines = computeDeadlines(makeUnit(), null, [], isoDate("2026-08-12"));

    expect(deadlines).toStrictEqual([]);
  });

  it("reste due même sans contrat d'entretien : l'obligation pèse sur le propriétaire", () => {
    const deadlines = computeDeadlines(
      makeUnit({ lastStatutoryInspectionOn: isoDate("2020-01-01") }),
      null,
      [],
      isoDate("2026-08-12"),
    );

    expect(find(deadlines, "inspection_5y").status).toBe("overdue");
  });

  it("reste due quand le contrat d'entretien est expiré", () => {
    const deadlines = computeDeadlines(
      makeUnit({ lastStatutoryInspectionOn: isoDate("2020-01-01") }),
      makeContract({ endsOn: isoDate("2026-03-31") }),
      [],
      isoDate("2026-08-12"),
    );

    expect(deadlines).toHaveLength(1);
    expect(find(deadlines, "inspection_5y").status).toBe("overdue");
  });
});

describe("R3 — statuts", () => {
  it("est ok tant que l'échéance est hors de la fenêtre d'alerte", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10")],
      isoDate("2026-04-13"),
    );

    expect(find(deadlines, "visit_6w").status).toBe("ok");
  });

  it("passe en due_soon au premier jour de la fenêtre d'alerte", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10")],
      isoDate("2026-04-14"),
    );

    expect(find(deadlines, "visit_6w").status).toBe("due_soon");
  });

  it("est encore due_soon le jour même de l'échéance", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10")],
      isoDate("2026-04-21"),
    );

    expect(find(deadlines, "visit_6w").status).toBe("due_soon");
  });

  it("passe en overdue le lendemain de l'échéance", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10")],
      isoDate("2026-04-22"),
    );

    expect(find(deadlines, "visit_6w").status).toBe("overdue");
  });

  it("marque en overdue un appareil sans visite depuis 7 semaines (scénario e2e L1.5)", () => {
    const deadlines = computeDeadlines(
      makeUnit(),
      makeContract(),
      [completedVisit("2026-03-10")],
      isoDate("2026-04-28"),
    );

    expect(find(deadlines, "visit_6w").status).toBe("overdue");
  });

  it("alerte le quinquennal à 6 mois", () => {
    const unit = makeUnit({ lastStatutoryInspectionOn: isoDate("2021-06-15") });

    expect(
      find(computeDeadlines(unit, null, [], isoDate("2025-12-14")), "inspection_5y").status,
    ).toBe("ok");
    expect(
      find(computeDeadlines(unit, null, [], isoDate("2025-12-15")), "inspection_5y").status,
    ).toBe("due_soon");
    expect(
      find(computeDeadlines(unit, null, [], isoDate("2026-06-15")), "inspection_5y").status,
    ).toBe("due_soon");
    expect(
      find(computeDeadlines(unit, null, [], isoDate("2026-06-16")), "inspection_5y").status,
    ).toBe("overdue");
  });

  it("applique l'écrêtage de fin de mois à la fenêtre d'alerte du quinquennal", () => {
    // Échéance au 2026-08-31 : 6 mois avant tombe sur le 2026-02-28 (février écrêté).
    const unit = makeUnit({ lastStatutoryInspectionOn: isoDate("2021-08-31") });

    expect(
      find(computeDeadlines(unit, null, [], isoDate("2026-02-27")), "inspection_5y").status,
    ).toBe("ok");
    expect(
      find(computeDeadlines(unit, null, [], isoDate("2026-02-28")), "inspection_5y").status,
    ).toBe("due_soon");
  });
});

describe("R4 — invariants multi-tenant", () => {
  it("refuse un contrat d'un autre tenant", () => {
    expect(() =>
      computeDeadlines(
        makeUnit(),
        makeContract({ tenantId: "tenant-2" }),
        [],
        isoDate("2026-08-12"),
      ),
    ).toThrow(DomainError);
  });

  it("refuse une visite d'un autre tenant", () => {
    expect(() =>
      computeDeadlines(
        makeUnit(),
        makeContract(),
        [completedVisit("2026-03-10", { tenantId: "tenant-2" })],
        isoDate("2026-08-12"),
      ),
    ).toThrow(/tenants différents/);
  });

  it("refuse une visite portant sur un autre appareil", () => {
    expect(() =>
      computeDeadlines(
        makeUnit(),
        makeContract(),
        [completedVisit("2026-03-10", { unitId: "unit-2" })],
        isoDate("2026-08-12"),
      ),
    ).toThrow(/concerne l'appareil unit-2/);
  });

  it("vérifie les invariants avant tout calcul, même sans contrat", () => {
    expect(() =>
      computeDeadlines(
        makeUnit(),
        null,
        [completedVisit("2026-03-10", { unitId: "unit-2" })],
        isoDate("2026-08-12"),
      ),
    ).toThrow(DomainError);
  });
});

describe("R5 — déterminisme", () => {
  const unit = makeUnit({ lastStatutoryInspectionOn: isoDate("2022-01-10") });
  const contract = makeContract({ startsOn: isoDate("2020-01-01") });
  const visits = [completedVisit("2026-08-01")];
  const referenceOn = isoDate("2026-08-12");

  it("trie par échéance croissante", () => {
    const deadlines = computeDeadlines(unit, contract, visits, referenceOn);

    expect(deadlines.map((deadline) => deadline.kind)).toStrictEqual(["visit_6w", "inspection_5y"]);
  });

  it("rend exactement le même résultat à entrées identiques", () => {
    expect(computeDeadlines(unit, contract, visits, referenceOn)).toStrictEqual(
      computeDeadlines(unit, contract, visits, referenceOn),
    );
  });

  it("reporte le tenant et l'appareil sur chaque échéance", () => {
    for (const deadline of computeDeadlines(unit, contract, visits, referenceOn)) {
      expect(deadline.tenantId).toBe(TENANT);
      expect(deadline.unitId).toBe(UNIT_ID);
    }
  });

  it("ne mute pas les entrées", () => {
    const input = [completedVisit("2026-08-01"), completedVisit("2026-07-01")];
    const snapshot = input.map((visit) => ({ ...visit }));
    computeDeadlines(unit, contract, input, referenceOn);

    expect(input).toStrictEqual(snapshot);
  });
});
