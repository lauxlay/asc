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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("CRUD /work-orders", () => {
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

  const createWorkOrder = (payload?: unknown) =>
    api.inject({
      method: "POST",
      url: "/api/work-orders",
      headers: bearer(token),
      payload: (payload ?? { unitId, summary: "Cabine bloquée au 3e" }) as object,
    });

  const patch = (id: string, payload: unknown) =>
    api.inject({
      method: "PATCH",
      url: `/api/work-orders/${id}`,
      headers: bearer(token),
      payload: payload as object,
    });

  const list = (query = "") =>
    api.inject({ method: "GET", url: `/api/work-orders${query}`, headers: bearer(token) });

  /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
  const otherTenantToken = (): Promise<string> =>
    api.jwt.signAsync({
      sub: "autre-utilisateur",
      tenantId: "tenant-b",
      email: "autre@ascenseur.test",
      role: TEST_USER.role,
    });

  /** Spec 007, R1 — la saisie minimale. */
  describe("POST /work-orders", () => {
    it("crée un OT avec deux champs seulement, le reste par défaut", async () => {
      const response = await createWorkOrder({ unitId, summary: "Cabine bloquée au 3e" });

      expect(response.statusCode).toBe(201);
      const workOrder = response.json<{
        id: string;
        reference: string;
        type: string;
        status: string;
        priority: string;
        reportCount: number;
      }>();
      expect(workOrder.id).toMatch(UUID_PATTERN);
      expect(workOrder.reference).toMatch(/^OT-\d{4}-\d{5}$/);
      expect(workOrder.type).toBe("breakdown");
      expect(workOrder.priority).toBe("normal");
      expect(workOrder.status).toBe("new");
      expect(workOrder.reportCount).toBe(1);
    });

    it("horodate le signalement dès la création", async () => {
      const workOrder = (await createWorkOrder()).json<{
        reportedAt: string;
        lastReportedAt: string;
      }>();

      expect(Number.isNaN(Date.parse(workOrder.reportedAt))).toBe(false);
      expect(workOrder.lastReportedAt).toBe(workOrder.reportedAt);
    });

    it("ignore un statut imposé par le client", async () => {
      const workOrder = (await createWorkOrder({ unitId, summary: "Panne", status: "done" })).json<{
        status: string;
      }>();

      expect(workOrder.status).toBe("new");
    });

    it("ignore une référence imposée par le client", async () => {
      const workOrder = (
        await createWorkOrder({ unitId, summary: "Panne", reference: "OT-1900-00001" })
      ).json<{ reference: string }>();

      expect(workOrder.reference).not.toBe("OT-1900-00001");
    });

    it("accepte le contact sur place et le ramène à null s'il est blanc", async () => {
      const avec = (
        await createWorkOrder({
          unitId,
          summary: "Panne",
          onSiteContact: "Mme Diallo — code 1234A",
        })
      ).json<{ onSiteContact: string }>();
      expect(avec.onSiteContact).toBe("Mme Diallo — code 1234A");

      const sans = (
        await createWorkOrder({ unitId, summary: "Panne", onSiteContact: "   " })
      ).json<{ onSiteContact: unknown }>();
      expect(sans.onSiteContact).toBeNull();
    });

    it.each([
      [{ summary: "Sans appareil" }, "appareil manquant"],
      [{ unitId: "x" }, "description manquante"],
      [{ unitId: "x", summary: "" }, "description vide"],
      [{ unitId: "x", summary: "Panne", type: "travaux" }, "type hors énumération"],
      [{ unitId: "x", summary: "Panne", priority: "p0" }, "criticité hors énumération"],
    ])("refuse une requête invalide (%s)", async (payload, _description) => {
      const body = { ...payload } as Record<string, unknown>;
      if (body.unitId === "x") {
        body.unitId = unitId;
      }

      expect((await createWorkOrder(body)).statusCode).toBe(400);
    });

    it("refuse un appareil inexistant", async () => {
      expect((await createWorkOrder({ unitId: "inexistant", summary: "Panne" })).statusCode).toBe(
        400,
      );
    });

    it("refuse un appareil d'un autre tenant, comme s'il était inconnu", async () => {
      const intruder = await otherTenantToken();
      const foreignSite = await createSite(api, intruder, { name: "Immeuble d'un autre" });
      const foreignUnit = await createUnit(api, intruder, foreignSite, "Ascenseur A");

      expect((await createWorkOrder({ unitId: foreignUnit, summary: "Panne" })).statusCode).toBe(
        400,
      );
    });
  });

  /** Spec 007, R3 — script de désincarcération. */
  describe("mode P0", () => {
    it("ouvre un script vide quand la criticité est entrapment", async () => {
      const workOrder = (
        await createWorkOrder({ unitId, summary: "Personne bloquée", priority: "entrapment" })
      ).json<{ entrapment: Record<string, unknown> }>();

      expect(workOrder.entrapment).toStrictEqual({
        medicalEmergency: null,
        peopleCount: null,
        betweenFloors: null,
      });
    });

    it("n'ouvre aucun script pour une criticité ordinaire", async () => {
      const workOrder = (await createWorkOrder()).json<{ entrapment: unknown }>();

      expect(workOrder.entrapment).toBeNull();
    });

    it("accepte les réponses au fil de la conversation", async () => {
      const created = (
        await createWorkOrder({ unitId, summary: "Personne bloquée", priority: "entrapment" })
      ).json<{ id: string }>();

      const response = await patch(created.id, {
        entrapment: { medicalEmergency: false, peopleCount: 2, betweenFloors: true },
      });

      expect(response.json<{ entrapment: unknown }>().entrapment).toStrictEqual({
        medicalEmergency: false,
        peopleCount: 2,
        betweenFloors: true,
      });
    });

    it("distingue une réponse non demandée d'une réponse négative", async () => {
      const created = (
        await createWorkOrder({
          unitId,
          summary: "Personne bloquée",
          priority: "entrapment",
          entrapment: { betweenFloors: false },
        })
      ).json<{ entrapment: { medicalEmergency: unknown; betweenFloors: unknown } }>();

      expect(created.entrapment.medicalEmergency).toBeNull();
      expect(created.entrapment.betweenFloors).toBe(false);
    });

    it("efface le script si la criticité est rétrogradée", async () => {
      const created = (
        await createWorkOrder({ unitId, summary: "Personne bloquée", priority: "entrapment" })
      ).json<{ id: string }>();

      const response = await patch(created.id, { priority: "normal" });

      expect(response.json<{ entrapment: unknown }>().entrapment).toBeNull();
    });
  });

  /** Spec 007, R2 — le rattachement, cœur du lot. */
  describe("POST /work-orders/:id/reports", () => {
    const attach = (id: string, as: string = token) =>
      api.inject({
        method: "POST",
        url: `/api/work-orders/${id}/reports`,
        headers: bearer(as),
      });

    it("incrémente le compteur sans créer d'OT", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();

      const response = await attach(created.id);

      expect(response.statusCode).toBe(200);
      expect(response.json<{ reportCount: number }>().reportCount).toBe(2);
      expect((await list()).json<{ items: unknown[] }>().items).toHaveLength(1);
    });

    it("compte cinq signalements du même incident", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();

      for (let index = 0; index < 4; index += 1) {
        await attach(created.id);
      }

      const reread = await api.inject({
        method: "GET",
        url: `/api/work-orders/${created.id}`,
        headers: bearer(token),
      });
      expect(reread.json<{ reportCount: number }>().reportCount).toBe(5);
    });

    it("avance lastReportedAt sans toucher au premier horodatage", async () => {
      const created = (await createWorkOrder()).json<{ id: string; reportedAt: string }>();

      const updated = (await attach(created.id)).json<{
        reportedAt: string;
        lastReportedAt: string;
      }>();

      expect(updated.reportedAt).toBe(created.reportedAt);
      expect(Date.parse(updated.lastReportedAt)).toBeGreaterThanOrEqual(
        Date.parse(created.reportedAt),
      );
    });

    it("refuse de rattacher à un OT clôturé", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();
      await patch(created.id, { status: "in_progress" });
      await patch(created.id, { status: "done" });

      const response = await attach(created.id);

      expect(response.statusCode).toBe(422);
    });

    it("répond 404 pour un OT inconnu", async () => {
      expect((await attach("inconnu")).statusCode).toBe(404);
    });

    it("ne laisse pas rattacher à l'OT d'un autre tenant", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();

      expect((await attach(created.id, await otherTenantToken())).statusCode).toBe(404);
    });
  });

  /** Spec 007, R4 — cycle de vie. */
  describe("transitions de statut", () => {
    it("mène un OT de bout en bout", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();

      expect((await patch(created.id, { status: "in_progress" })).statusCode).toBe(200);
      const done = await patch(created.id, { status: "done" });
      expect(done.statusCode).toBe(200);
      expect(done.json<{ status: string }>().status).toBe("done");
    });

    it("refuse de sauter l'intervention", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();

      expect((await patch(created.id, { status: "done" })).statusCode).toBe(422);
    });

    it("refuse de rouvrir un OT clôturé", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();
      await patch(created.id, { status: "in_progress" });
      await patch(created.id, { status: "done" });

      expect((await patch(created.id, { status: "in_progress" })).statusCode).toBe(422);
    });

    it("annonce les transitions possibles dans le message d'erreur", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();

      const response = await patch(created.id, { status: "done" });

      expect(response.json<{ message: string }>().message).toContain("in_progress");
    });

    it("permet d'annuler un OT neuf", async () => {
      const created = (await createWorkOrder()).json<{ id: string }>();

      expect((await patch(created.id, { status: "cancelled" })).statusCode).toBe(200);
    });
  });

  /** Spec 007, R5 — chaînage. */
  describe("chaînage des OT", () => {
    const chain = (id: string) =>
      api.inject({ method: "GET", url: `/api/work-orders/${id}/chain`, headers: bearer(token) });

    it("chaîne un nouvel OT à un ancien clôturé", async () => {
      const premier = (await createWorkOrder()).json<{ id: string }>();
      await patch(premier.id, { status: "in_progress" });
      await patch(premier.id, { status: "done" });

      const suite = await createWorkOrder({
        unitId,
        summary: "La panne est revenue",
        followUpOf: premier.id,
      });

      expect(suite.statusCode).toBe(201);
      expect(suite.json<{ followUpOf: string }>().followUpOf).toBe(premier.id);
    });

    it("rend la chaîne dans les deux sens", async () => {
      const premier = (await createWorkOrder()).json<{ id: string }>();
      const second = (
        await createWorkOrder({ unitId, summary: "Suite", followUpOf: premier.id })
      ).json<{ id: string }>();

      const depuisLeSecond = (await chain(second.id)).json<{
        followUpChain: { id: string }[];
        followedUpBy: unknown[];
      }>();
      expect(depuisLeSecond.followUpChain.map((w) => w.id)).toStrictEqual([premier.id]);
      expect(depuisLeSecond.followedUpBy).toStrictEqual([]);

      const depuisLePremier = (await chain(premier.id)).json<{
        followedUpBy: { id: string }[];
      }>();
      expect(depuisLePremier.followedUpBy.map((w) => w.id)).toStrictEqual([second.id]);
    });

    it("refuse un OT parent inexistant", async () => {
      expect(
        (await createWorkOrder({ unitId, summary: "Suite", followUpOf: "inconnu" })).statusCode,
      ).toBe(400);
    });

    it("refuse un parent appartenant à un autre tenant", async () => {
      const intruder = await otherTenantToken();
      const foreignSite = await createSite(api, intruder, { name: "Immeuble d'un autre" });
      const foreignUnit = await createUnit(api, intruder, foreignSite, "Ascenseur A");
      const foreign = await api.inject({
        method: "POST",
        url: "/api/work-orders",
        headers: bearer(intruder),
        payload: { unitId: foreignUnit, summary: "Panne" },
      });

      const response = await createWorkOrder({
        unitId,
        summary: "Suite",
        followUpOf: foreign.json<{ id: string }>().id,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  /** Spec 007, R9 — ordre et filtres. */
  describe("GET /work-orders", () => {
    it("rend du plus récent au plus ancien", async () => {
      await createWorkOrder({ unitId, summary: "Premier" });
      await createWorkOrder({ unitId, summary: "Second" });
      await createWorkOrder({ unitId, summary: "Troisième" });

      const items = (await list()).json<{ items: { summary: string }[] }>().items;

      expect(items.map((w) => w.summary)).toStrictEqual(["Troisième", "Second", "Premier"]);
    });

    it("filtre les OT ouverts — ce dont la détection de doublon a besoin", async () => {
      const clos = (await createWorkOrder({ unitId, summary: "Clos" })).json<{ id: string }>();
      await patch(clos.id, { status: "cancelled" });
      await createWorkOrder({ unitId, summary: "Ouvert" });

      const items = (await list(`?unitId=${unitId}&open=true`)).json<{
        items: { summary: string }[];
      }>().items;

      expect(items.map((w) => w.summary)).toStrictEqual(["Ouvert"]);
    });

    it("ne confond pas open=false avec open=true", async () => {
      const clos = (await createWorkOrder({ unitId, summary: "Clos" })).json<{ id: string }>();
      await patch(clos.id, { status: "cancelled" });
      await createWorkOrder({ unitId, summary: "Ouvert" });

      const items = (await list("?open=false")).json<{ items: { summary: string }[] }>().items;

      expect(items.map((w) => w.summary)).toStrictEqual(["Clos"]);
    });

    it("filtre par statut, par type et par appareil", async () => {
      const autre = await createUnit(api, token, siteId, "Ascenseur B");
      await createWorkOrder({ unitId, summary: "Panne A" });
      await createWorkOrder({ unitId: autre, summary: "Visite B", type: "visit" });

      expect(
        (await list("?type=visit"))
          .json<{ items: { summary: string }[] }>()
          .items.map((w) => w.summary),
      ).toStrictEqual(["Visite B"]);
      expect((await list(`?unitId=${unitId}`)).json<{ items: unknown[] }>().items).toHaveLength(1);
      expect((await list("?status=new")).json<{ items: unknown[] }>().items).toHaveLength(2);
    });

    it("refuse un filtre hors énumération", async () => {
      expect((await list("?status=peut-etre")).statusCode).toBe(400);
    });

    it("répond 404 pour un OT inconnu", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/work-orders/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("isolation entre tenants", () => {
    it("ne mélange pas les listes de deux tenants", async () => {
      await createWorkOrder();

      const response = await api.inject({
        method: "GET",
        url: "/api/work-orders",
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("numérote chaque tenant indépendamment", async () => {
      await createWorkOrder();
      await createWorkOrder();

      const intruder = await otherTenantToken();
      const foreignSite = await createSite(api, intruder, { name: "Immeuble d'un autre" });
      const foreignUnit = await createUnit(api, intruder, foreignSite, "Ascenseur A");
      const foreign = await api.inject({
        method: "POST",
        url: "/api/work-orders",
        headers: bearer(intruder),
        payload: { unitId: foreignUnit, summary: "Panne" },
      });

      expect(foreign.json<{ reference: string }>().reference).toMatch(/-00001$/);
    });
  });
});
