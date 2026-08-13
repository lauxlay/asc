import { describe, expect, it } from "vitest";
import { isoDate } from "../date/iso-date.js";
import type { Contract, Unit } from "../entities.js";
import type { ComplianceDeadline, DeadlineStatus } from "./deadlines.js";
import { activeContractFor, worstDeadlineStatus } from "./parc-compliance.js";

/** Spec 006, R2 et R3 — contrat applicable et statut de synthèse. */

const TENANT = "tenant-a";

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "unit-1",
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
    reference: "CT-2026-001",
    type: "minimal",
    unitIds: ["unit-1"],
    startsOn: isoDate("2026-01-01"),
    endsOn: null,
    ...overrides,
  };
}

function deadline(status: DeadlineStatus): ComplianceDeadline {
  return {
    tenantId: TENANT,
    unitId: "unit-1",
    kind: "visit_6w",
    dueOn: isoDate("2026-02-12"),
    status,
  };
}

describe("activeContractFor", () => {
  it("rend null quand aucun contrat n'existe", () => {
    expect(activeContractFor(makeUnit(), [], isoDate("2026-06-01"))).toBeNull();
  });

  it("rend le contrat qui couvre l'appareil ce jour-là", () => {
    const contract = makeContract();

    expect(activeContractFor(makeUnit(), [contract], isoDate("2026-06-01"))).toBe(contract);
  });

  it("ignore un contrat qui ne liste pas l'appareil", () => {
    const autre = makeContract({ unitIds: ["unit-9"] });

    expect(activeContractFor(makeUnit(), [autre], isoDate("2026-06-01"))).toBeNull();
  });

  it("ignore un contrat expiré", () => {
    const expire = makeContract({ endsOn: isoDate("2026-03-31") });

    expect(activeContractFor(makeUnit(), [expire], isoDate("2026-06-01"))).toBeNull();
  });

  it("ignore un contrat pas encore entré en vigueur", () => {
    const futur = makeContract({ startsOn: isoDate("2027-01-01") });

    expect(activeContractFor(makeUnit(), [futur], isoDate("2026-06-01"))).toBeNull();
  });

  it("choisit le contrat en cours parmi un historique", () => {
    const ancien = makeContract({
      id: "c-2024",
      startsOn: isoDate("2024-01-01"),
      endsOn: isoDate("2025-01-01"),
    });
    const courant = makeContract({ id: "c-2025", startsOn: isoDate("2025-01-02"), endsOn: null });

    expect(activeContractFor(makeUnit(), [ancien, courant], isoDate("2026-06-01"))).toBe(courant);
  });

  it("retrouve un contrat historique si on se place à sa période", () => {
    const ancien = makeContract({
      id: "c-2024",
      startsOn: isoDate("2024-01-01"),
      endsOn: isoDate("2025-01-01"),
    });
    const courant = makeContract({ id: "c-2025", startsOn: isoDate("2025-01-02"), endsOn: null });

    expect(activeContractFor(makeUnit(), [ancien, courant], isoDate("2024-06-01"))).toBe(ancien);
  });

  it("couvre les bornes du contrat", () => {
    const contract = makeContract({
      startsOn: isoDate("2026-01-01"),
      endsOn: isoDate("2027-01-01"),
    });

    expect(activeContractFor(makeUnit(), [contract], isoDate("2026-01-01"))).toBe(contract);
    expect(activeContractFor(makeUnit(), [contract], isoDate("2027-01-01"))).toBe(contract);
    expect(activeContractFor(makeUnit(), [contract], isoDate("2025-12-31"))).toBeNull();
    expect(activeContractFor(makeUnit(), [contract], isoDate("2027-01-02"))).toBeNull();
  });

  it("ne retient jamais le contrat d'un autre tenant", () => {
    const etranger = makeContract({ tenantId: "tenant-b" });

    expect(activeContractFor(makeUnit(), [etranger], isoDate("2026-06-01"))).toBeNull();
  });
});

describe("worstDeadlineStatus", () => {
  it("rend null sans aucune échéance : on ne sait pas", () => {
    expect(worstDeadlineStatus([])).toBeNull();
  });

  it("rend le statut unique quand il n'y en a qu'un", () => {
    expect(worstDeadlineStatus([deadline("ok")])).toBe("ok");
  });

  it("fait primer le retard sur tout le reste", () => {
    expect(worstDeadlineStatus([deadline("ok"), deadline("overdue"), deadline("due_soon")])).toBe(
      "overdue",
    );
  });

  it("fait primer l'échéance proche sur le conforme", () => {
    expect(worstDeadlineStatus([deadline("ok"), deadline("due_soon")])).toBe("due_soon");
  });

  it("ne dépend pas de l'ordre des échéances", () => {
    const melange = [deadline("due_soon"), deadline("ok"), deadline("overdue")];
    const inverse = [...melange].reverse();

    expect(worstDeadlineStatus(melange)).toBe(worstDeadlineStatus(inverse));
  });

  it("rend ok quand tout est conforme", () => {
    expect(worstDeadlineStatus([deadline("ok"), deadline("ok")])).toBe("ok");
  });
});
