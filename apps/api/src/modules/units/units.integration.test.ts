import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createSite,
  createTestApp,
  login,
  TEST_SITE,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("CRUD /units", () => {
  let api: TestApp;
  let token: string;
  /** Un appareil exige un site existant (spec 002, R1). */
  let siteId: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
    siteId = await createSite(api, token);
  });

  afterEach(async () => {
    await api.close();
  });

  const createUnit = (payload?: unknown) =>
    api.inject({
      method: "POST",
      url: "/api/units",
      headers: bearer(token),
      payload: (payload ?? { siteId, reference: "Ascenseur A" }) as object,
    });

  /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
  const otherTenantToken = (): Promise<string> =>
    api.jwt.signAsync({
      sub: "autre-utilisateur",
      tenantId: "tenant-b",
      email: "autre@ascenseur.test",
      role: TEST_USER.role,
    });

  describe("POST /units", () => {
    it("crée un appareil avec un UUID applicatif et le tenant du jeton", async () => {
      const response = await createUnit({
        siteId,
        reference: "Ascenseur A",
        commissionedOn: "2015-06-01",
        lastStatutoryInspectionOn: null,
      });

      expect(response.statusCode).toBe(201);
      const unit = response.json<{ id: string; tenantId: string; siteId: string }>();
      expect(unit.id).toMatch(UUID_PATTERN);
      expect(unit.tenantId).toBe("default");
      expect(unit.siteId).toBe(siteId);
    });

    it("rend les dates optionnelles à null quand elles sont absentes", async () => {
      const unit = (await createUnit()).json<{
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
          siteId,
          reference: "Ascenseur A",
        })
      ).json<{ id: string; tenantId: string }>();

      // Le serveur décide de l'identité et du tenant, jamais le client.
      expect(unit.id).not.toBe("id-choisi-par-le-client");
      expect(unit.tenantId).toBe("default");
    });

    it("retire les espaces de bord du repère", async () => {
      const unit = (await createUnit({ siteId, reference: "  Ascenseur A  " })).json<{
        reference: string;
      }>();

      expect(unit.reference).toBe("Ascenseur A");
    });

    it("accepte deux appareils au même repère dans le même immeuble", async () => {
      // Le repère n'est pas unique (spec 002, R1.3) : une reprise de parc
      // existant a le droit de contenir des doublons de saisie.
      expect((await createUnit({ siteId, reference: "Ascenseur A" })).statusCode).toBe(201);
      expect((await createUnit({ siteId, reference: "Ascenseur A" })).statusCode).toBe(201);
    });

    // Payloads construits à partir du `siteId` du test : les cas « manquant »
    // doivent réellement omettre le champ, pas se le faire réinjecter.
    it.each([
      [(_site: string) => ({ reference: "Ascenseur A" }), "siteId manquant"],
      [(_site: string) => ({ siteId: "", reference: "A" }), "siteId vide"],
      [(_site: string) => ({ siteId: "   ", reference: "A" }), "siteId d'espaces"],
      [(site: string) => ({ siteId: site }), "repère manquant"],
      [(site: string) => ({ siteId: site, reference: "" }), "repère vide"],
      [(site: string) => ({ siteId: site, reference: "   " }), "repère d'espaces"],
      [(_site: string) => ({}), "corps vide"],
    ])("refuse une requête invalide (%s)", async (buildPayload, _description) => {
      const response = await createUnit(buildPayload(siteId));

      expect(response.statusCode).toBe(400);
    });

    it.each([
      [{ commissionedOn: "01/06/2015" }, "date au mauvais format"],
      [{ commissionedOn: "2026-02-30" }, "date inexistante"],
    ])("refuse une date invalide (%s)", async (payload, _description) => {
      const response = await createUnit({ siteId, reference: "Ascenseur A", ...payload });

      expect(response.statusCode).toBe(400);
    });
  });

  /** Spec 002, R1 — un appareil est toujours rattaché à un immeuble existant. */
  describe("rattachement à un site", () => {
    it("refuse un siteId qui ne désigne aucun site", async () => {
      const response = await createUnit({ siteId: "site-inexistant", reference: "Ascenseur A" });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un siteId appartenant à un autre tenant, comme s'il était inconnu", async () => {
      const intruder = await otherTenantToken();
      const foreignSite = await createSite(api, intruder, { name: "Immeuble d'un autre tenant" });

      const response = await createUnit({ siteId: foreignSite, reference: "Ascenseur A" });

      expect(response.statusCode).toBe(400);
    });

    it("refuse de déplacer un appareil vers un site inexistant", async () => {
      const created = (await createUnit()).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
        payload: { siteId: "site-inexistant" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("accepte de déplacer un appareil vers un autre site du tenant", async () => {
      const created = (await createUnit()).json<{ id: string }>();
      const autreSite = await createSite(api, token, { name: "Le Clos Fleuri" });

      const response = await api.inject({
        method: "PATCH",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
        payload: { siteId: autreSite },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ siteId: string }>().siteId).toBe(autreSite);
    });
  });

  describe("GET /units", () => {
    it("liste les appareils du tenant", async () => {
      await createUnit();
      await createUnit({ siteId, reference: "Ascenseur B" });

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

    it("filtre les appareils par site", async () => {
      await createUnit({ siteId, reference: "Ascenseur A" });
      const autreSite = await createSite(api, token, { name: "Le Clos Fleuri" });
      await createUnit({ siteId: autreSite, reference: "Ascenseur unique" });

      const response = await api.inject({
        method: "GET",
        url: `/api/units?siteId=${autreSite}`,
        headers: bearer(token),
      });

      const items = response.json<{ items: { reference: string }[] }>().items;
      expect(items).toHaveLength(1);
      expect(items[0]?.reference).toBe("Ascenseur unique");
    });

    it("rend une liste vide pour un site sans appareil", async () => {
      await createUnit();
      const vide = await createSite(api, token, { name: "Immeuble vide" });

      const response = await api.inject({
        method: "GET",
        url: `/api/units?siteId=${vide}`,
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
      const created = (
        await createUnit({ siteId, reference: "Ascenseur A", commissionedOn: "2015-06-01" })
      ).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/units/${created.id}`,
        headers: bearer(token),
        payload: { reference: "Ascenseur B" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toStrictEqual({
        id: created.id,
        tenantId: "default",
        siteId,
        reference: "Ascenseur B",
        commissionedOn: "2015-06-01",
        lastStatutoryInspectionOn: null,
      });
    });

    it("permet de remettre une date à null", async () => {
      const created = (
        await createUnit({ siteId, reference: "Ascenseur A", commissionedOn: "2015-06-01" })
      ).json<{ id: string }>();

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
        payload: { reference: "Ascenseur B" },
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
    it("ne laisse pas lire l'appareil d'un autre tenant", async () => {
      const created = (await createUnit()).json<{ id: string }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/units/${created.id}`,
        headers: bearer(await otherTenantToken()),
      });

      expect(response.statusCode).toBe(404);
    });

    it("ne laisse pas supprimer l'appareil d'un autre tenant", async () => {
      const created = (await createUnit()).json<{ id: string }>();

      const deletion = await api.inject({
        method: "DELETE",
        url: `/api/units/${created.id}`,
        headers: bearer(await otherTenantToken()),
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
      await createUnit();

      const response = await api.inject({
        method: "GET",
        url: "/api/units",
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("ne fait pas fuir un appareil par le filtre de site d'un autre tenant", async () => {
      await createUnit();

      const response = await api.inject({
        method: "GET",
        url: `/api/units?siteId=${siteId}`,
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });
  });

  it("expose l'adresse du site créé pour le rattachement", async () => {
    // Garde-fou de cohérence : le site de test reste celui que les autres
    // suites croient utiliser.
    const response = await api.inject({
      method: "GET",
      url: `/api/sites/${siteId}`,
      headers: bearer(token),
    });

    expect(response.json<{ addressLine: string }>().addressLine).toBe(TEST_SITE.addressLine);
  });
});
