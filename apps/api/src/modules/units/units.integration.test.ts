import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createTestApp,
  login,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("CRUD /units", () => {
  let api: TestApp;
  let token: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
  });

  afterEach(async () => {
    await api.close();
  });

  const createUnit = (payload: unknown = { siteId: "site-1" }) =>
    api.inject({
      method: "POST",
      url: "/api/units",
      headers: bearer(token),
      payload: payload as object,
    });

  describe("POST /units", () => {
    it("crée un appareil avec un UUID applicatif et le tenant du jeton", async () => {
      const response = await createUnit({
        siteId: "site-1",
        commissionedOn: "2015-06-01",
        lastStatutoryInspectionOn: null,
      });

      expect(response.statusCode).toBe(201);
      const unit = response.json<{ id: string; tenantId: string; siteId: string }>();
      expect(unit.id).toMatch(UUID_PATTERN);
      expect(unit.tenantId).toBe("default");
      expect(unit.siteId).toBe("site-1");
    });

    it("rend les dates optionnelles à null quand elles sont absentes", async () => {
      const unit = (await createUnit({ siteId: "site-1" })).json<{
        commissionedOn: unknown;
        lastStatutoryInspectionOn: unknown;
      }>();

      expect(unit.commissionedOn).toBeNull();
      expect(unit.lastStatutoryInspectionOn).toBeNull();
    });

    it("ignore un id et un tenantId envoyés par le client", async () => {
      const unit = (
        await createUnit({
          id: "id-choisi-par-le-client",
          tenantId: "tenant-pirate",
          siteId: "site-1",
        })
      ).json<{ id: string; tenantId: string }>();

      // Le serveur décide de l'identité et du tenant, jamais le client.
      expect(unit.id).not.toBe("id-choisi-par-le-client");
      expect(unit.tenantId).toBe("default");
    });

    it.each([
      [{ siteId: "" }, "siteId vide"],
      [{ siteId: "   " }, "siteId d'espaces"],
      [{}, "siteId manquant"],
      [{ siteId: "site-1", commissionedOn: "01/06/2015" }, "date au mauvais format"],
      [{ siteId: "site-1", commissionedOn: "2026-02-30" }, "date inexistante"],
    ])("refuse une requête invalide (%s)", async (payload, _description) => {
      const response = await createUnit(payload);

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /units", () => {
    it("liste les appareils du tenant", async () => {
      await createUnit({ siteId: "site-1" });
      await createUnit({ siteId: "site-2" });

      const response = await api.inject({
        method: "GET",
        url: "/api/units",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ items: unknown[] }>().items).toHaveLength(2);
    });

    it("rend une liste vide quand le parc est vide", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/units",
        headers: bearer(token),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("rend un appareil par son identifiant", async () => {
      const created = (await createUnit()).json<{ id: string }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ id: string }>().id).toBe(created.id);
    });

    it("répond 404 pour un appareil inconnu", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/units/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /units/:id", () => {
    it("ne modifie que les champs fournis", async () => {
      const created = (await createUnit({ siteId: "site-1", commissionedOn: "2015-06-01" })).json<{
        id: string;
      }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
        payload: { siteId: "site-2" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toStrictEqual({
        id: created.id,
        tenantId: "default",
        siteId: "site-2",
        commissionedOn: "2015-06-01",
        lastStatutoryInspectionOn: null,
      });
    });

    it("permet de remettre une date à null", async () => {
      const created = (await createUnit({ siteId: "site-1", commissionedOn: "2015-06-01" })).json<{
        id: string;
      }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
        payload: { commissionedOn: null },
      });

      expect(response.json<{ commissionedOn: unknown }>().commissionedOn).toBeNull();
    });

    it("répond 404 pour un appareil inconnu", async () => {
      const response = await api.inject({
        method: "PATCH",
        url: "/api/units/inconnu",
        headers: bearer(token),
        payload: { siteId: "site-2" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("refuse une modification invalide", async () => {
      const created = (await createUnit()).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
        payload: { commissionedOn: "hier" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("DELETE /units/:id", () => {
    it("supprime l'appareil", async () => {
      const created = (await createUnit()).json<{ id: string }>();

      const deleted = await api.inject({
        method: "DELETE",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
      });
      expect(deleted.statusCode).toBe(204);

      const reread = await api.inject({
        method: "GET",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
      });
      expect(reread.statusCode).toBe(404);
    });

    it("répond 404 pour un appareil inconnu", async () => {
      const response = await api.inject({
        method: "DELETE",
        url: "/api/units/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("isolation entre tenants", () => {
    /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
    const otherTenantToken = (api: TestApp): Promise<string> =>
      api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });

    it("ne laisse pas lire l'appareil d'un autre tenant", async () => {
      const created = (await createUnit()).json<{ id: string }>();
      const intruder = await otherTenantToken(api);

      const response = await api.inject({
        method: "GET",
        url: `/api/units/${created.id}`,
        headers: bearer(intruder),
      });

      expect(response.statusCode).toBe(404);
    });

    it("ne laisse pas supprimer l'appareil d'un autre tenant", async () => {
      const created = (await createUnit()).json<{ id: string }>();
      const intruder = await otherTenantToken(api);

      const deletion = await api.inject({
        method: "DELETE",
        url: `/api/units/${created.id}`,
        headers: bearer(intruder),
      });
      expect(deletion.statusCode).toBe(404);

      const stillThere = await api.inject({
        method: "GET",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
      });
      expect(stillThere.statusCode).toBe(200);
    });

    it("ne mélange pas les listes de deux tenants", async () => {
      await createUnit({ siteId: "site-a" });
      const intruder = await otherTenantToken(api);

      const response = await api.inject({
        method: "GET",
        url: "/api/units",
        headers: bearer(intruder),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });
  });
});
