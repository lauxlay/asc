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

/** Spec 008, R2 et R4 à R8 — affectation et planning de la semaine. */

const MONDAY = "2026-08-10";
const THURSDAY = "2026-08-13";
const NEXT_MONDAY = "2026-08-17";

describe("planning et affectation", () => {
  let api: TestApp;
  let token: string;
  let unitId: string;
  let technicianId: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
    const siteId = await createSite(api, token);
    unitId = await createUnit(api, token, siteId, "Ascenseur A");
    technicianId = await createTechnician("marc.vidal@ascenseur.test", "Marc Vidal");
  });

  afterEach(async () => {
    await api.close();
  });

  async function createTechnician(email: string, name: string): Promise<string> {
    const response = await api.inject({
      method: "POST",
      url: "/api/users",
      headers: bearer(token),
      payload: { email, name, role: "technician", password: "mot-de-passe-initial-2026" },
    });
    return response.json<{ id: string }>().id;
  }

  async function createWorkOrder(overrides: Record<string, unknown> = {}): Promise<string> {
    const response = await api.inject({
      method: "POST",
      url: "/api/work-orders",
      headers: bearer(token),
      payload: { unitId, summary: "Cabine bloquée au 3e", ...overrides },
    });
    return response.json<{ id: string }>().id;
  }

  const assign = (id: string, payload: unknown) =>
    api.inject({
      method: "PATCH",
      url: `/api/work-orders/${id}/assignment`,
      headers: bearer(token),
      payload: payload as object,
    });

  const planning = (week?: string) =>
    api.inject({
      method: "GET",
      url: week === undefined ? "/api/planning" : `/api/planning?week=${week}`,
      headers: bearer(token),
    });

  const setStatus = (id: string, status: string) =>
    api.inject({
      method: "PATCH",
      url: `/api/work-orders/${id}`,
      headers: bearer(token),
      payload: { status },
    });

  describe("PATCH /work-orders/:id/assignment", () => {
    it("planifie un OT et le fait passer `assigned`", async () => {
      const id = await createWorkOrder();

      const response = await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        assignee: technicianId,
        scheduledOn: THURSDAY,
        status: "assigned",
      });
    });

    it("renvoie un OT au backlog et le fait repasser `new`", async () => {
      const id = await createWorkOrder();
      await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });

      const response = await assign(id, { assignee: null, scheduledOn: null });

      expect(response.json()).toMatchObject({
        assignee: null,
        scheduledOn: null,
        status: "new",
      });
    });

    it("refuse un technicien sans jour", async () => {
      const id = await createWorkOrder();

      expect((await assign(id, { assignee: technicianId, scheduledOn: null })).statusCode).toBe(
        422,
      );
    });

    it("refuse un jour sans technicien", async () => {
      const id = await createWorkOrder();

      expect((await assign(id, { assignee: null, scheduledOn: THURSDAY })).statusCode).toBe(422);
    });

    it("refuse un utilisateur inconnu", async () => {
      const id = await createWorkOrder();

      expect((await assign(id, { assignee: "inconnu", scheduledOn: THURSDAY })).statusCode).toBe(
        400,
      );
    });

    it("refuse un utilisateur désactivé", async () => {
      const id = await createWorkOrder();
      await api.inject({
        method: "PATCH",
        url: `/api/users/${technicianId}`,
        headers: bearer(token),
        payload: { active: false },
      });

      expect((await assign(id, { assignee: technicianId, scheduledOn: THURSDAY })).statusCode).toBe(
        400,
      );
    });

    it("refuse un jour qui n'existe pas", async () => {
      const id = await createWorkOrder();

      expect(
        (await assign(id, { assignee: technicianId, scheduledOn: "2026-02-30" })).statusCode,
      ).toBe(400);
    });

    it("laisse réaffecter un OT commencé", async () => {
      const id = await createWorkOrder();
      await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });
      await setStatus(id, "in_progress");
      const replacement = await createTechnician("sofia@ascenseur.test", "Sofia Mercier");

      const response = await assign(id, { assignee: replacement, scheduledOn: THURSDAY });

      expect(response.json()).toMatchObject({ assignee: replacement, status: "in_progress" });
    });

    it("refuse de renvoyer au backlog un OT commencé", async () => {
      const id = await createWorkOrder();
      await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });
      await setStatus(id, "in_progress");

      expect((await assign(id, { assignee: null, scheduledOn: null })).statusCode).toBe(422);
    });

    it("fige l'affectation d'un OT clôturé", async () => {
      const id = await createWorkOrder();
      await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });
      await setStatus(id, "in_progress");
      await setStatus(id, "done");

      expect((await assign(id, { assignee: technicianId, scheduledOn: MONDAY })).statusCode).toBe(
        422,
      );
    });

    it("refuse de demander le statut `assigned` par le PATCH général", async () => {
      const id = await createWorkOrder();

      expect((await setStatus(id, "assigned")).statusCode).toBe(400);
    });

    it("rend 404 sur un OT d'un autre tenant", async () => {
      const id = await createWorkOrder();
      const otherToken = await api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });

      const response = await api.inject({
        method: "PATCH",
        url: `/api/work-orders/${id}/assignment`,
        headers: bearer(otherToken),
        payload: { assignee: technicianId, scheduledOn: THURSDAY },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /planning", () => {
    it("rend les sept jours de la semaine demandée, lundi en tête", async () => {
      const response = await planning(THURSDAY);

      expect(response.json()).toMatchObject({
        weekStartsOn: MONDAY,
        days: [
          MONDAY,
          "2026-08-11",
          "2026-08-12",
          THURSDAY,
          "2026-08-14",
          "2026-08-15",
          "2026-08-16",
        ],
      });
    });

    it("place l'OT planifié dans la ligne de son technicien", async () => {
      const id = await createWorkOrder();
      await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });

      const rows = (await planning(THURSDAY)).json<{
        rows: { user: { id: string }; cards: { workOrder: { id: string } }[] }[];
      }>().rows;

      const row = rows.find((candidate) => candidate.user.id === technicianId);
      expect(row?.cards.map((card) => card.workOrder.id)).toStrictEqual([id]);
    });

    it("porte l'immeuble et l'appareil sur la carte", async () => {
      const id = await createWorkOrder();
      await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });

      const rows = (await planning(THURSDAY)).json<{
        rows: { user: { id: string }; cards: { unitReference: string; siteName: string }[] }[];
      }>().rows;

      expect(rows.find((row) => row.user.id === technicianId)?.cards[0]).toMatchObject({
        unitReference: "Ascenseur A",
        siteName: "Résidence Les Tilleuls",
      });
    });

    it("ne montre pas dans une semaine l'OT planifié dans une autre", async () => {
      const id = await createWorkOrder();
      await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });

      const rows = (await planning(NEXT_MONDAY)).json<{
        rows: { user: { id: string }; cards: unknown[] }[];
      }>().rows;

      expect(rows.find((row) => row.user.id === technicianId)?.cards).toStrictEqual([]);
    });

    it("liste une ligne par utilisateur actif", async () => {
      const ids = (await planning(THURSDAY))
        .json<{ rows: { user: { id: string } }[] }>()
        .rows.map((row) => row.user.id);

      expect(ids).toContain(TEST_USER.id);
      expect(ids).toContain(technicianId);
    });

    it("retire la ligne d'un désactivé qui ne porte rien", async () => {
      await api.inject({
        method: "PATCH",
        url: `/api/users/${technicianId}`,
        headers: bearer(token),
        payload: { active: false },
      });

      const ids = (await planning(THURSDAY))
        .json<{ rows: { user: { id: string } }[] }>()
        .rows.map((row) => row.user.id);

      expect(ids).not.toContain(technicianId);
    });

    it("garde la ligne d'un désactivé qui porte des OT dans la semaine", async () => {
      // Rien ne disparaît en silence : ses interventions doivent être vues
      // pour être redistribuées (R5.3).
      const id = await createWorkOrder();
      await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });
      await api.inject({
        method: "PATCH",
        url: `/api/users/${technicianId}`,
        headers: bearer(token),
        payload: { active: false },
      });

      const rows = (await planning(THURSDAY)).json<{
        rows: { user: { id: string; active: boolean }; cards: unknown[] }[];
      }>().rows;

      const row = rows.find((candidate) => candidate.user.id === technicianId);
      expect(row?.user.active).toBe(false);
      expect(row?.cards).toHaveLength(1);
    });

    it("ne laisse fuir aucune empreinte de mot de passe", async () => {
      const response = await planning(THURSDAY);

      expect(response.body).not.toContain("scrypt$");
      expect(response.body).not.toContain("passwordHash");
    });

    describe("backlog", () => {
      it("contient les OT ouverts et non planifiés", async () => {
        const id = await createWorkOrder();

        const backlog = (await planning(THURSDAY)).json<{
          backlog: { workOrder: { id: string } }[];
        }>().backlog;

        expect(backlog.map((card) => card.workOrder.id)).toStrictEqual([id]);
      });

      it("ne dépend pas de la semaine affichée", async () => {
        const id = await createWorkOrder();

        const backlog = (await planning(NEXT_MONDAY)).json<{
          backlog: { workOrder: { id: string } }[];
        }>().backlog;

        expect(backlog.map((card) => card.workOrder.id)).toStrictEqual([id]);
      });

      it("se vide de l'OT qu'on vient de planifier", async () => {
        const id = await createWorkOrder();
        await assign(id, { assignee: technicianId, scheduledOn: THURSDAY });

        const backlog = (await planning(THURSDAY)).json<{ backlog: unknown[] }>().backlog;

        expect(backlog).toStrictEqual([]);
      });

      it("place la désincarcération en tête, avant une panne plus ancienne", async () => {
        const older = await createWorkOrder({ summary: "Porte qui grince" });
        const entrapment = await createWorkOrder({
          summary: "Personne bloquée",
          priority: "entrapment",
        });

        const backlog = (await planning(THURSDAY)).json<{
          backlog: { workOrder: { id: string } }[];
        }>().backlog;

        expect(backlog.map((card) => card.workOrder.id)).toStrictEqual([entrapment, older]);
      });

      it("ne contient pas les OT clôturés", async () => {
        const id = await createWorkOrder();
        await setStatus(id, "cancelled");

        expect((await planning(THURSDAY)).json<{ backlog: unknown[] }>().backlog).toStrictEqual([]);
      });
    });

    it("refuse une semaine qui n'est pas un jour valide", async () => {
      expect((await planning("2026-13-01")).statusCode).toBe(400);
    });

    it("rend la semaine courante quand aucune n'est demandée", async () => {
      const response = await planning();

      expect(response.statusCode).toBe(200);
      expect(response.json<{ days: string[] }>().days).toHaveLength(7);
    });

    it("exige un jeton", async () => {
      expect((await api.inject({ method: "GET", url: "/api/planning" })).statusCode).toBe(401);
    });
  });
});
