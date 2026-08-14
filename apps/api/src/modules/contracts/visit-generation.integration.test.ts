import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createSite,
  createTestApp,
  createUnit,
  login,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

/** Spec 009 — génération des visites périodiques. */

interface VisitCounters {
  readonly created: number;
  readonly alreadyPlanned: number;
  readonly coveredUntil: string | null;
}

interface WorkOrderRow {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly priority: string;
  readonly unitId: string;
  readonly summary: string;
  readonly dueOn: string | null;
  readonly assignee: string | null;
  readonly scheduledOn: string | null;
}

describe("génération des visites périodiques", () => {
  let api: TestApp;
  let token: string;
  let siteId: string;
  let unitId: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
    siteId = await createSite(api, token);
    unitId = await createUnit(api, token, siteId, "Ascenseur A");
  });

  afterEach(async () => {
    await api.close();
  });

  /** Le contrat démarre aujourd'hui : les échéances tombent donc à venir. */
  const todayIso = () => new Date().toISOString().slice(0, 10);

  async function createContract(overrides: Record<string, unknown> = {}): Promise<string> {
    const response = await api.inject({
      method: "POST",
      url: "/api/contracts",
      headers: bearer(token),
      payload: {
        reference: "CT-2026-001",
        type: "minimal",
        unitIds: [unitId],
        startsOn: todayIso(),
        ...overrides,
      },
    });
    return response.json<{ id: string }>().id;
  }

  const generate = (contractId: string) =>
    api.inject({
      method: "POST",
      url: `/api/contracts/${contractId}/visits`,
      headers: bearer(token),
    });

  async function visits(): Promise<WorkOrderRow[]> {
    const response = await api.inject({
      method: "GET",
      url: "/api/work-orders?type=visit",
      headers: bearer(token),
    });
    return response.json<{ items: WorkOrderRow[] }>().items;
  }

  describe("à la création du contrat", () => {
    it("pose immédiatement les visites, sans second appel", async () => {
      await createContract();

      // Douze mois à 35 jours d'intervalle : dix créneaux.
      expect(await visits()).toHaveLength(10);
    });

    it("crée des OT de type visite, au backlog, avec leur échéance", async () => {
      await createContract();

      const [visit] = await visits();
      expect(visit).toMatchObject({
        type: "visit",
        status: "new",
        priority: "normal",
        unitId,
        summary: "Visite périodique",
        assignee: null,
        scheduledOn: null,
      });
      expect(visit?.dueOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("échelonne les échéances de 35 jours", async () => {
      await createContract();

      const dueDates = (await visits())
        .map((visit) => visit.dueOn)
        .filter((due): due is string => due !== null)
        .sort();

      const gaps = dueDates.slice(1).map((due, index) => {
        const previous = Date.parse(`${dueDates[index] as string}T00:00:00Z`);
        return (Date.parse(`${due}T00:00:00Z`) - previous) / 86_400_000;
      });
      expect(new Set(gaps)).toStrictEqual(new Set([35]));
    });

    it("produit une série par appareil couvert", async () => {
      const second = await createUnit(api, token, siteId, "Ascenseur B");
      await createContract({ unitIds: [unitId, second] });

      const generated = await visits();
      expect(generated.filter((visit) => visit.unitId === unitId)).toHaveLength(10);
      expect(generated.filter((visit) => visit.unitId === second)).toHaveLength(10);
    });

    it("ne produit rien pour un contrat sans appareil", async () => {
      await createContract({ unitIds: [] });

      expect(await visits()).toStrictEqual([]);
    });

    it("s'arrête à la fin du contrat", async () => {
      const endsOn = new Date(Date.now() + 80 * 86_400_000).toISOString().slice(0, 10);
      // Contrat d'un an minimum exigé par la spec 005 : on part d'hier pour que
      // la durée reste légale tout en bornant l'horizon plus tôt.
      await createContract({
        startsOn: new Date(Date.now() - 300 * 86_400_000).toISOString().slice(0, 10),
        endsOn,
      });

      const generated = await visits();
      expect(generated.length).toBeGreaterThan(0);
      for (const visit of generated) {
        expect(visit.dueOn && visit.dueOn <= endsOn).toBe(true);
      }
    });
  });

  describe("POST /contracts/:id/visits", () => {
    it("rend les compteurs de la génération", async () => {
      const contractId = await createContract({ unitIds: [] });

      await api.inject({
        method: "PATCH",
        url: `/api/contracts/${contractId}`,
        headers: bearer(token),
        payload: { unitIds: [unitId] },
      });
      const counters = (await generate(contractId)).json<VisitCounters>();

      expect(counters).toMatchObject({ created: 10, alreadyPlanned: 0 });
      expect(counters.coveredUntil).not.toBeNull();
    });

    it("est idempotente : regénérer ne crée aucun doublon", async () => {
      const contractId = await createContract();

      const counters = (await generate(contractId)).json<VisitCounters>();

      expect(counters).toMatchObject({ created: 0, alreadyPlanned: 10 });
      expect(await visits()).toHaveLength(10);
    });

    it("laisse intacte une visite déjà planifiée", async () => {
      const contractId = await createContract();
      const [visit] = await visits();
      const technician = await createTechnician();
      await api.inject({
        method: "PATCH",
        url: `/api/work-orders/${visit?.id}/assignment`,
        headers: bearer(token),
        payload: { assignee: technician, scheduledOn: visit?.dueOn },
      });

      await generate(contractId);

      const after = (await visits()).find((candidate) => candidate.id === visit?.id);
      expect(after).toMatchObject({ assignee: technician, status: "assigned" });
      expect(await visits()).toHaveLength(10);
    });

    it("ne ressuscite pas une visite annulée", async () => {
      const contractId = await createContract();
      const [visit] = await visits();
      await api.inject({
        method: "PATCH",
        url: `/api/work-orders/${visit?.id}`,
        headers: bearer(token),
        payload: { status: "cancelled" },
      });

      await generate(contractId);

      expect(await visits()).toHaveLength(10);
      expect((await visits()).find((candidate) => candidate.id === visit?.id)?.status).toBe(
        "cancelled",
      );
    });

    it("ignore un appareil du contrat qui n'existe plus", async () => {
      const doomed = await createUnit(api, token, siteId, "Ascenseur B");
      const contractId = await createContract({ unitIds: [unitId, doomed] });
      // Les visites de l'appareil supprimé restent : la génération est additive.
      await api.inject({
        method: "DELETE",
        url: `/api/units/${doomed}`,
        headers: bearer(token),
      });

      const counters = (await generate(contractId)).json<VisitCounters>();

      expect(counters.created).toBe(0);
      expect(counters.alreadyPlanned).toBe(10);
    });

    it("rend 404 sur un contrat inconnu", async () => {
      expect((await generate("inconnu")).statusCode).toBe(404);
    });

    it("rend 404 sur le contrat d'un autre tenant", async () => {
      const contractId = await createContract();
      const otherToken = await api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });

      const response = await api.inject({
        method: "POST",
        url: `/api/contracts/${contractId}/visits`,
        headers: bearer(otherToken),
      });

      expect(response.statusCode).toBe(404);
    });

    it("exige un jeton", async () => {
      const contractId = await createContract();

      const response = await api.inject({
        method: "POST",
        url: `/api/contracts/${contractId}/visits`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("dans le planning", () => {
    it("les visites générées attendent au backlog", async () => {
      await createContract();

      const backlog = (
        await api.inject({ method: "GET", url: "/api/planning", headers: bearer(token) })
      ).json<{ backlog: { workOrder: { type: string } }[] }>().backlog;

      expect(backlog.filter((card) => card.workOrder.type === "visit")).toHaveLength(10);
    });

    it("passent après une panne dans l'ordre du backlog", async () => {
      await createContract();
      await api.inject({
        method: "POST",
        url: "/api/work-orders",
        headers: bearer(token),
        payload: { unitId, summary: "Personne bloquée", priority: "entrapment" },
      });

      const backlog = (
        await api.inject({ method: "GET", url: "/api/planning", headers: bearer(token) })
      ).json<{ backlog: { workOrder: { type: string } }[] }>().backlog;

      expect(backlog[0]?.workOrder.type).toBe("breakdown");
    });
  });

  async function createTechnician(): Promise<string> {
    const response = await api.inject({
      method: "POST",
      url: "/api/users",
      headers: bearer(token),
      payload: {
        email: "marc.vidal@ascenseur.test",
        name: "Marc Vidal",
        role: "technician",
        password: "mot-de-passe-initial-2026",
      },
    });
    return response.json<{ id: string }>().id;
  }
});
