import { describe, expect, it } from "vitest";
import { isoDate } from "../date/iso-date.js";
import type { Contract } from "../entities.js";
import {
  missingVisits,
  type ScheduledVisit,
  scheduleVisits,
  VISIT_SCHEDULE_HORIZON_MONTHS,
  VISIT_SCHEDULE_INTERVAL_DAYS,
  visitKey,
} from "./visit-schedule.js";

/** Spec 009, R1 et R3 — calendrier prévisionnel des visites. */

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    tenantId: "tenant-a",
    reference: "CT-2026-014",
    type: "minimal",
    unitIds: ["unit-1"],
    startsOn: isoDate("2026-01-01"),
    endsOn: null,
    ...overrides,
  };
}

const TODAY = isoDate("2026-01-01");

function daysOf(visits: readonly ScheduledVisit[]): string[] {
  return visits.map((visit) => visit.dueOn);
}

describe("scheduleVisits", () => {
  it("pose la première visite un intervalle après la prise d'effet", () => {
    const visits = scheduleVisits(makeContract(), TODAY);

    expect(visits[0]?.dueOn).toBe("2026-02-05");
  });

  it("espace les visites d'exactement 35 jours", () => {
    const visits = scheduleVisits(makeContract(), TODAY);

    expect(daysOf(visits).slice(0, 4)).toStrictEqual([
      "2026-02-05",
      "2026-03-12",
      "2026-04-16",
      "2026-05-21",
    ]);
  });

  it("reste dans la marge légale des six semaines", () => {
    // La règle est « au moins une toutes les 6 semaines » : l'intervalle de
    // génération doit lui laisser du jeu, sans quoi le moindre report est une
    // infraction.
    expect(VISIT_SCHEDULE_INTERVAL_DAYS).toBeLessThan(42);
  });

  it("couvre douze mois et pas davantage", () => {
    const visits = scheduleVisits(makeContract(), TODAY);

    // Dix créneaux dans l'année, le dernier à cinq semaines de l'horizon.
    expect(visits.at(-1)?.dueOn).toBe("2026-12-17");
    expect(visits).toHaveLength(10);
    expect(VISIT_SCHEDULE_HORIZON_MONTHS).toBe(12);
  });

  it("s'arrête à la fin du contrat quand elle tombe avant l'horizon", () => {
    const visits = scheduleVisits(makeContract({ endsOn: isoDate("2026-04-30") }), TODAY);

    expect(daysOf(visits)).toStrictEqual(["2026-02-05", "2026-03-12", "2026-04-16"]);
  });

  it("ne produit rien quand le contrat se termine avant la première échéance", () => {
    expect(scheduleVisits(makeContract({ endsOn: isoDate("2026-01-15") }), TODAY)).toStrictEqual([]);
  });

  it("ignore le passé et reprend à la prochaine échéance à venir", () => {
    // Contrat de 2023 généré en 2026 : on prépare, on ne réécrit pas
    // l'historique.
    const visits = scheduleVisits(
      makeContract({ startsOn: isoDate("2023-03-01") }),
      isoDate("2026-06-15"),
    );

    // La série reste celle du contrat : on reprend au créneau suivant, sans
    // recaler le rythme sur la date de génération.
    expect(visits[0]?.dueOn).toBe("2026-07-08");
    for (const visit of visits) {
      expect(visit.dueOn >= "2026-06-15").toBe(true);
    }
  });

  it("garde des dates ancrées sur le contrat, quelle que soit la date de génération", () => {
    // C'est ce qui rend l'idempotence possible sans marqueur en base.
    const contract = makeContract({ startsOn: isoDate("2023-03-01") });
    const early = scheduleVisits(contract, isoDate("2026-06-15"));
    const late = scheduleVisits(contract, isoDate("2026-08-20"));

    const common = new Set(daysOf(early));
    const overlap = daysOf(late).filter((day) => common.has(day));
    expect(overlap.length).toBeGreaterThan(0);
  });

  it("produit une série par appareil couvert", () => {
    const visits = scheduleVisits(makeContract({ unitIds: ["unit-1", "unit-2", "unit-3"] }), TODAY);

    expect(visits.filter((visit) => visit.dueOn === "2026-02-05").map((visit) => visit.unitId)).
      toStrictEqual(["unit-1", "unit-2", "unit-3"]);
    expect(visits).toHaveLength(30);
  });

  it("ne produit rien pour un contrat sans appareil", () => {
    expect(scheduleVisits(makeContract({ unitIds: [] }), TODAY)).toStrictEqual([]);
  });

  it("rend les échéances dans l'ordre chronologique", () => {
    const days = daysOf(scheduleVisits(makeContract({ unitIds: ["unit-1", "unit-2"] }), TODAY));

    expect([...days].sort()).toStrictEqual(days);
  });

  it("est déterministe", () => {
    const contract = makeContract({ unitIds: ["unit-1", "unit-2"] });

    expect(scheduleVisits(contract, TODAY)).toStrictEqual(scheduleVisits(contract, TODAY));
  });

  it("traverse une année bissextile sans décaler la cadence", () => {
    const visits = scheduleVisits(makeContract({ startsOn: isoDate("2028-01-25") }), isoDate("2028-01-25"));

    // 25 janvier + 35 jours = 29 février, qui existe en 2028.
    expect(visits[0]?.dueOn).toBe("2028-02-29");
    expect(visits[1]?.dueOn).toBe("2028-04-04");
  });

  it("enjambe le passage d'année", () => {
    const visits = scheduleVisits(
      makeContract({ startsOn: isoDate("2026-11-20") }),
      isoDate("2026-11-20"),
    );

    expect(daysOf(visits).slice(0, 2)).toStrictEqual(["2026-12-25", "2027-01-29"]);
  });

  it("ne bronche pas sur le changement d'heure", () => {
    // Les jours calendaires ignorent les fuseaux : la semaine du passage à
    // l'heure d'été fait sept jours comme les autres.
    const visits = scheduleVisits(
      makeContract({ startsOn: isoDate("2026-02-22") }),
      isoDate("2026-02-22"),
    );

    expect(visits[0]?.dueOn).toBe("2026-03-29");
  });
});

describe("missingVisits", () => {
  const planned: readonly ScheduledVisit[] = [
    { unitId: "unit-1", dueOn: isoDate("2026-02-05") },
    { unitId: "unit-1", dueOn: isoDate("2026-03-12") },
    { unitId: "unit-2", dueOn: isoDate("2026-02-05") },
  ];

  it("rend tout quand rien n'existe", () => {
    expect(missingVisits(planned, new Set())).toStrictEqual(planned);
  });

  it("retire les échéances déjà couvertes", () => {
    const covered = new Set([visitKey("unit-1", isoDate("2026-02-05"))]);

    expect(missingVisits(planned, covered)).toStrictEqual([planned[1], planned[2]]);
  });

  it("distingue deux appareils à la même date", () => {
    const covered = new Set([visitKey("unit-2", isoDate("2026-02-05"))]);

    expect(missingVisits(planned, covered).map((visit) => visit.unitId)).toStrictEqual([
      "unit-1",
      "unit-1",
    ]);
  });

  it("ne rend rien quand tout est couvert", () => {
    const covered = new Set(planned.map((visit) => visitKey(visit.unitId, visit.dueOn)));

    expect(missingVisits(planned, covered)).toStrictEqual([]);
  });

  it("ignore les couvertures qui ne correspondent à rien de prévu", () => {
    const covered = new Set([visitKey("unit-9", isoDate("2030-01-01"))]);

    expect(missingVisits(planned, covered)).toStrictEqual(planned);
  });
});

describe("visitKey", () => {
  it("identifie une visite par son appareil et son jour", () => {
    expect(visitKey("unit-1", isoDate("2026-02-05"))).toBe("unit-1 2026-02-05");
  });

  it("ne confond pas deux appareils ni deux jours", () => {
    expect(visitKey("unit-1", isoDate("2026-02-05"))).not.toBe(
      visitKey("unit-2", isoDate("2026-02-05")),
    );
    expect(visitKey("unit-1", isoDate("2026-02-05"))).not.toBe(
      visitKey("unit-1", isoDate("2026-03-12")),
    );
  });
});
