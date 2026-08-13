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

describe("CRUD /contracts", () => {
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

  const baseContract = () => ({
    reference: "CT-2026-001",
    type: "minimal",
    unitIds: [unitId],
    startsOn: "2026-01-01",
  });

  const createContract = (payload?: unknown) =>
    api.inject({
      method: "POST",
      url: "/api/contracts",
      headers: bearer(token),
      payload: (payload ?? baseContract()) as object,
    });

  /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
  const otherTenantToken = (): Promise<string> =>
    api.jwt.signAsync({
      sub: "autre-utilisateur",
      tenantId: "tenant-b",
      email: "autre@ascenseur.test",
      role: TEST_USER.role,
    });

  describe("POST /contracts", () => {
    it("crée un contrat avec un UUID applicatif et le tenant du jeton", async () => {
      const response = await createContract();

      expect(response.statusCode).toBe(201);
      expect(response.json()).toStrictEqual({
        id: expect.stringMatching(UUID_PATTERN) as unknown,
        tenantId: "default",
        reference: "CT-2026-001",
        type: "minimal",
        unitIds: [unitId],
        startsOn: "2026-01-01",
        endsOn: null,
      });
    });

    it.each([["minimal"], ["extended"]])("accepte le contrat type %s", async (type) => {
      const response = await createContract({ ...baseContract(), type });

      expect(response.statusCode).toBe(201);
      expect(response.json<{ type: string }>().type).toBe(type);
    });

    it("accepte un contrat sans appareil : les appareils suivent", async () => {
      const response = await createContract({ ...baseContract(), unitIds: [] });

      expect(response.statusCode).toBe(201);
      expect(response.json<{ unitIds: unknown[] }>().unitIds).toStrictEqual([]);
    });

    it("laisse endsOn à null : tacite reconduction", async () => {
      expect((await createContract()).json<{ endsOn: unknown }>().endsOn).toBeNull();
    });

    it.each([
      [{ reference: "" }, "référence vide"],
      [{ type: "premium" }, "type hors énumération"],
      [{ startsOn: "01/01/2026" }, "date au mauvais format"],
      [{ startsOn: "2026-02-30" }, "date inexistante"],
    ])("refuse une requête invalide (%s)", async (patch, _description) => {
      expect((await createContract({ ...baseContract(), ...patch })).statusCode).toBe(400);
    });
  });

  /** Spec 005, R2 — durée minimale légale d'un an. */
  describe("durée du contrat", () => {
    it("accepte un contrat d'exactement un an", async () => {
      const response = await createContract({
        ...baseContract(),
        startsOn: "2026-01-01",
        endsOn: "2027-01-01",
      });

      expect(response.statusCode).toBe(201);
    });

    it("refuse un contrat d'un jour de moins qu'un an", async () => {
      const response = await createContract({
        ...baseContract(),
        startsOn: "2026-01-01",
        endsOn: "2026-12-31",
      });

      expect(response.statusCode).toBe(422);
    });

    it("refuse une fin antérieure au début", async () => {
      const response = await createContract({
        ...baseContract(),
        startsOn: "2026-06-01",
        endsOn: "2026-01-01",
      });

      expect(response.statusCode).toBe(422);
    });

    it("refuse aussi de raccourcir un contrat existant sous un an", async () => {
      const created = (await createContract()).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/contracts/${created.id}`,
        headers: bearer(token),
        payload: { endsOn: "2026-03-01" },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  /** Spec 005, R3 — couverture des appareils. */
  describe("couverture des appareils", () => {
    it("refuse un appareil inexistant", async () => {
      const response = await createContract({ ...baseContract(), unitIds: ["unit-inexistant"] });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un appareil appartenant à un autre tenant, comme s'il était inconnu", async () => {
      const intruder = await otherTenantToken();
      const foreignSite = await createSite(api, intruder, { name: "Immeuble d'un autre" });
      const foreignUnit = await createUnit(api, intruder, foreignSite, "Ascenseur A");

      const response = await createContract({ ...baseContract(), unitIds: [foreignUnit] });

      expect(response.statusCode).toBe(400);
    });

    it("refuse le même appareil cité deux fois", async () => {
      const response = await createContract({ ...baseContract(), unitIds: [unitId, unitId] });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un appareil déjà couvert sur une période qui se chevauche", async () => {
      expect((await createContract()).statusCode).toBe(201);

      const response = await createContract({
        ...baseContract(),
        reference: "CT-2026-002",
        startsOn: "2026-06-01",
      });

      expect(response.statusCode).toBe(409);
    });

    it("accepte deux contrats successifs sur le même appareil", async () => {
      expect(
        (
          await createContract({
            ...baseContract(),
            startsOn: "2024-01-01",
            endsOn: "2025-01-01",
          })
        ).statusCode,
      ).toBe(201);

      const response = await createContract({
        ...baseContract(),
        reference: "CT-2025-002",
        startsOn: "2025-01-02",
      });

      expect(response.statusCode).toBe(201);
    });

    it("ne se considère pas en conflit avec lui-même à la modification", async () => {
      const created = (await createContract()).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/contracts/${created.id}`,
        headers: bearer(token),
        payload: { reference: "CT-2026-001-bis" },
      });

      expect(response.statusCode).toBe(200);
    });

    it("lie plusieurs appareils d'un coup", async () => {
      const second = await createUnit(api, token, siteId, "Ascenseur B");
      const third = await createUnit(api, token, siteId, "Ascenseur C");

      const response = await createContract({
        ...baseContract(),
        unitIds: [unitId, second, third],
      });

      expect(response.statusCode).toBe(201);
      expect(response.json<{ unitIds: unknown[] }>().unitIds).toHaveLength(3);
    });
  });

  /** Spec 005, R4 — le moteur d'échéances du lot L0.2 est enfin appelé. */
  describe("GET /contracts/:id/deadlines", () => {
    it("rend l'échéance de visite à six semaines de la prise d'effet", async () => {
      const created = (await createContract({ ...baseContract(), startsOn: "2026-01-01" })).json<{
        id: string;
      }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/contracts/${created.id}/deadlines`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        evaluatedOn: string;
        items: { kind: string; dueOn: string; unitReference: string; siteName: string }[];
      }>();
      const visit = body.items.find((item) => item.kind === "visit_6w");
      // 2026-01-01 + 42 jours (spec 001, R1.3).
      expect(visit?.dueOn).toBe("2026-02-12");
      expect(visit?.unitReference).toBe("Ascenseur A");
      expect(visit?.siteName).toBe("Résidence Les Tilleuls");
      expect(body.evaluatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("rend une échéance par appareil couvert", async () => {
      const second = await createUnit(api, token, siteId, "Ascenseur B");
      const third = await createUnit(api, token, siteId, "Ascenseur C");
      const created = (
        await createContract({ ...baseContract(), unitIds: [unitId, second, third] })
      ).json<{ id: string }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/contracts/${created.id}/deadlines`,
        headers: bearer(token),
      });

      const items = response.json<{ items: { kind: string }[] }>().items;
      expect(items.filter((item) => item.kind === "visit_6w")).toHaveLength(3);
    });

    it("ajoute l'échéance quinquennale quand la mise en service est connue", async () => {
      const withDate = await api.inject({
        method: "POST",
        url: "/api/units",
        headers: bearer(token),
        payload: { siteId, reference: "Ascenseur D", commissionedOn: "2020-03-15" },
      });
      const otherUnit = withDate.json<{ id: string }>().id;

      const created = (await createContract({ ...baseContract(), unitIds: [otherUnit] })).json<{
        id: string;
      }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/contracts/${created.id}/deadlines`,
        headers: bearer(token),
      });

      const items = response.json<{ items: { kind: string; dueOn: string }[] }>().items;
      const inspection = items.find((item) => item.kind === "inspection_5y");
      expect(inspection?.dueOn).toBe("2025-03-15");
    });

    it("rend une liste vide pour un contrat sans appareil", async () => {
      const created = (await createContract({ ...baseContract(), unitIds: [] })).json<{
        id: string;
      }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/contracts/${created.id}/deadlines`,
        headers: bearer(token),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("n'écrit rien : deux appels rendent le même résultat", async () => {
      const created = (await createContract()).json<{ id: string }>();
      const url = `/api/contracts/${created.id}/deadlines`;

      const first = await api.inject({ method: "GET", url, headers: bearer(token) });
      const second = await api.inject({ method: "GET", url, headers: bearer(token) });

      expect(second.json()).toStrictEqual(first.json());
    });

    it("répond 404 pour un contrat inconnu", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/contracts/inconnu/deadlines",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /contracts", () => {
    it("liste les contrats du tenant dans l'ordre d'insertion", async () => {
      await createContract();
      const second = await createUnit(api, token, siteId, "Ascenseur B");
      await createContract({ ...baseContract(), reference: "CT-2026-002", unitIds: [second] });

      const response = await api.inject({
        method: "GET",
        url: "/api/contracts",
        headers: bearer(token),
      });

      expect(
        response.json<{ items: { reference: string }[] }>().items.map((c) => c.reference),
      ).toStrictEqual(["CT-2026-001", "CT-2026-002"]);
    });

    it("filtre par appareil couvert", async () => {
      const second = await createUnit(api, token, siteId, "Ascenseur B");
      await createContract();
      await createContract({ ...baseContract(), reference: "CT-2026-002", unitIds: [second] });

      const response = await api.inject({
        method: "GET",
        url: `/api/contracts?unitId=${second}`,
        headers: bearer(token),
      });

      const items = response.json<{ items: { reference: string }[] }>().items;
      expect(items).toHaveLength(1);
      expect(items[0]?.reference).toBe("CT-2026-002");
    });

    it("répond 404 pour un contrat inconnu", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/contracts/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /contracts/:id", () => {
    it("supprime le contrat et libère ses appareils", async () => {
      const created = (await createContract()).json<{ id: string }>();

      const deleted = await api.inject({
        method: "DELETE",
        url: `/api/contracts/${created.id}`,
        headers: bearer(token),
      });
      expect(deleted.statusCode).toBe(204);

      // L'appareil redevient couvrable par un nouveau contrat.
      expect(
        (await createContract({ ...baseContract(), reference: "CT-2026-002" })).statusCode,
      ).toBe(201);
    });

    it("répond 404 pour un contrat inconnu", async () => {
      const response = await api.inject({
        method: "DELETE",
        url: "/api/contracts/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("isolation entre tenants", () => {
    it("ne laisse pas lire le contrat d'un autre tenant", async () => {
      const created = (await createContract()).json<{ id: string }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/contracts/${created.id}`,
        headers: bearer(await otherTenantToken()),
      });

      expect(response.statusCode).toBe(404);
    });

    it("ne mélange pas les listes de deux tenants", async () => {
      await createContract();

      const response = await api.inject({
        method: "GET",
        url: "/api/contracts",
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("ne compte pas le contrat d'un autre tenant comme un chevauchement", async () => {
      await createContract();

      // Un autre tenant, son propre appareil : aucun conflit possible.
      const intruder = await otherTenantToken();
      const foreignSite = await createSite(api, intruder, { name: "Immeuble d'un autre" });
      const foreignUnit = await createUnit(api, intruder, foreignSite, "Ascenseur A");

      const response = await api.inject({
        method: "POST",
        url: "/api/contracts",
        headers: bearer(intruder),
        payload: { ...baseContract(), unitIds: [foreignUnit] },
      });

      expect(response.statusCode).toBe(201);
    });
  });
});
