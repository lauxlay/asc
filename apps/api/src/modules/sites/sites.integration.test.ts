import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createCustomer,
  createTestApp,
  login,
  TEST_SITE,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("CRUD /sites", () => {
  let api: TestApp;
  let token: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
  });

  afterEach(async () => {
    await api.close();
  });

  const createSiteRaw = (payload: unknown = TEST_SITE) =>
    api.inject({
      method: "POST",
      url: "/api/sites",
      headers: bearer(token),
      payload: payload as object,
    });

  const listSites = (query = "") =>
    api.inject({ method: "GET", url: `/api/sites${query}`, headers: bearer(token) });

  const searchNames = async (query: string): Promise<string[]> => {
    const response = await listSites(query);
    return response.json<{ items: { name: string }[] }>().items.map((site) => site.name);
  };

  describe("POST /sites", () => {
    it("crée un site avec un UUID applicatif et le tenant du jeton", async () => {
      const response = await createSiteRaw();

      expect(response.statusCode).toBe(201);
      expect(response.json()).toStrictEqual({
        id: expect.stringMatching(UUID_PATTERN) as unknown,
        tenantId: "default",
        customerId: null,
        ...TEST_SITE,
      });
    });

    it("ignore un id et un tenantId envoyés par le client", async () => {
      const site = (
        await createSiteRaw({
          ...TEST_SITE,
          id: "id-choisi-par-le-client",
          tenantId: "tenant-pirate",
        })
      ).json<{ id: string; tenantId: string }>();

      // Le serveur décide de l'identité et du tenant, jamais le client.
      expect(site.id).not.toBe("id-choisi-par-le-client");
      expect(site.tenantId).toBe("default");
    });

    it("retire les espaces de bord de l'adresse", async () => {
      const site = (
        await createSiteRaw({ ...TEST_SITE, name: "  Résidence Les Tilleuls  " })
      ).json<{ name: string }>();

      expect(site.name).toBe("Résidence Les Tilleuls");
    });

    it.each([
      [{ ...TEST_SITE, name: "" }, "nom vide"],
      [{ ...TEST_SITE, name: "   " }, "nom d'espaces"],
      [{ ...TEST_SITE, addressLine: "" }, "voie vide"],
      [{ ...TEST_SITE, postalCode: "" }, "code postal vide"],
      [{ ...TEST_SITE, city: "" }, "ville vide"],
      [{ name: "Sans adresse" }, "champs manquants"],
      [{}, "corps vide"],
    ])("refuse une requête invalide (%s)", async (payload, _description) => {
      expect((await createSiteRaw(payload)).statusCode).toBe(400);
    });
  });

  describe("GET /sites", () => {
    it("rend une liste vide quand le parc est vide", async () => {
      expect((await listSites()).json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("liste les sites du tenant dans l'ordre d'insertion", async () => {
      await createSiteRaw({ ...TEST_SITE, name: "Site A" });
      await createSiteRaw({ ...TEST_SITE, name: "Site B" });

      expect(await searchNames("")).toStrictEqual(["Site A", "Site B"]);
    });

    it("rend un site par son identifiant", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ id: string }>().id).toBe(created.id);
    });

    it("répond 404 pour un site inconnu", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/sites/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  /** Spec 002, R2 — la règle elle-même est testée dans `@asc/domain`. */
  describe("GET /sites?q= — recherche par adresse", () => {
    beforeEach(async () => {
      await createSiteRaw({
        name: "Résidence de l'Église",
        addressLine: "3 allée des Roses",
        postalCode: "69003",
        city: "Lyon",
      });
      await createSiteRaw({
        name: "Le Clos Fleuri",
        addressLine: "12 rue des Lilas",
        postalCode: "13008",
        city: "Marseille",
      });
    });

    it("trouve par voie", async () => {
      expect(await searchNames("?q=rue des lilas")).toStrictEqual(["Le Clos Fleuri"]);
    });

    it("trouve par ville", async () => {
      expect(await searchNames("?q=marseille")).toStrictEqual(["Le Clos Fleuri"]);
    });

    it("trouve par code postal", async () => {
      expect(await searchNames("?q=69003")).toStrictEqual(["Résidence de l'Église"]);
    });

    it("ignore les accents et la casse", async () => {
      expect(await searchNames("?q=EGLISE")).toStrictEqual(["Résidence de l'Église"]);
    });

    it("rend tout le parc pour une requête vide ou blanche", async () => {
      expect(await searchNames("?q=")).toHaveLength(2);
      expect(await searchNames("?q=%20%20")).toHaveLength(2);
      expect(await searchNames("")).toHaveLength(2);
    });

    it("rend une liste vide sans correspondance, ce n'est pas une erreur", async () => {
      const response = await listSites("?q=bordeaux");

      expect(response.statusCode).toBe(200);
      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });
  });

  describe("PATCH /sites/:id", () => {
    it("ne modifie que les champs fournis", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
        payload: { city: "Villeurbanne" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toStrictEqual({
        id: created.id,
        tenantId: "default",
        customerId: null,
        ...TEST_SITE,
        city: "Villeurbanne",
      });
    });

    it("répond 404 pour un site inconnu", async () => {
      const response = await api.inject({
        method: "PATCH",
        url: "/api/sites/inconnu",
        headers: bearer(token),
        payload: { city: "Villeurbanne" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("refuse une modification invalide", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
        payload: { city: "  " },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  /** Spec 002, R3 — un immeuble encore équipé n'est pas supprimable. */
  describe("DELETE /sites/:id", () => {
    const addUnit = (siteId: string) =>
      api.inject({
        method: "POST",
        url: "/api/units",
        headers: bearer(token),
        payload: { siteId, reference: "Ascenseur A" },
      });

    it("supprime un site sans appareil", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();

      const deleted = await api.inject({
        method: "DELETE",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });
      expect(deleted.statusCode).toBe(204);

      const reread = await api.inject({
        method: "GET",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });
      expect(reread.statusCode).toBe(404);
    });

    it("refuse de supprimer un site qui porte un appareil", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();
      await addUnit(created.id);

      const response = await api.inject({
        method: "DELETE",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(409);
    });

    it("laisse le site et son appareil intacts après un refus", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();
      await addUnit(created.id);

      await api.inject({
        method: "DELETE",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });

      const stillThere = await api.inject({
        method: "GET",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });
      expect(stillThere.statusCode).toBe(200);
    });

    it("redevient supprimable une fois son dernier appareil retiré", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();
      const unit = (await addUnit(created.id)).json<{ id: string }>();

      await api.inject({
        method: "DELETE",
        url: `/api/units/${unit.id}`,
        headers: bearer(token),
      });

      const response = await api.inject({
        method: "DELETE",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });
      expect(response.statusCode).toBe(204);
    });

    it("répond 404 pour un site inconnu", async () => {
      const response = await api.inject({
        method: "DELETE",
        url: "/api/sites/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  /** Spec 003, R1 — rattachement d'un immeuble à son client. */
  describe("rattachement à un client", () => {
    it("crée un site rattaché à un client existant", async () => {
      const customerId = await createCustomer(api, token);

      const response = await createSiteRaw({ ...TEST_SITE, customerId });

      expect(response.statusCode).toBe(201);
      expect(response.json<{ customerId: string }>().customerId).toBe(customerId);
    });

    it("refuse un customerId qui ne désigne aucun client", async () => {
      const response = await createSiteRaw({ ...TEST_SITE, customerId: "client-inexistant" });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un client appartenant à un autre tenant, comme s'il était inconnu", async () => {
      const intruder = await api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });
      const foreignCustomer = await createCustomer(api, intruder, { name: "Client d'un autre" });

      const response = await createSiteRaw({ ...TEST_SITE, customerId: foreignCustomer });

      expect(response.statusCode).toBe(400);
    });

    it("rattache puis détache un immeuble par PATCH", async () => {
      const customerId = await createCustomer(api, token);
      const created = (await createSiteRaw()).json<{ id: string }>();

      const attached = await api.inject({
        method: "PATCH",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
        payload: { customerId },
      });
      expect(attached.json<{ customerId: string }>().customerId).toBe(customerId);

      const detached = await api.inject({
        method: "PATCH",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
        payload: { customerId: null },
      });
      expect(detached.json<{ customerId: unknown }>().customerId).toBeNull();
    });

    it("porte autant d'immeubles que voulu pour un même client", async () => {
      const customerId = await createCustomer(api, token);
      await createSiteRaw({ ...TEST_SITE, customerId, name: "Immeuble 1" });
      await createSiteRaw({ ...TEST_SITE, customerId, name: "Immeuble 2" });

      const response = await listSites(`?customerId=${customerId}`);

      expect(response.json<{ items: unknown[] }>().items).toHaveLength(2);
    });

    it("ne fait pas fuir les immeubles d'un client par le filtre", async () => {
      const customerId = await createCustomer(api, token);
      await createSiteRaw({ ...TEST_SITE, customerId });
      await createSiteRaw({ ...TEST_SITE, name: "Immeuble sans client" });

      const response = await listSites(`?customerId=${customerId}`);

      expect(response.json<{ items: { name: string }[] }>().items).toHaveLength(1);
    });
  });

  /** Spec 003, R4 — un immeuble portant un gardien n'est pas supprimable. */
  describe("suppression et contacts rattachés", () => {
    const addGardien = (siteId: string, customerId: string) =>
      api.inject({
        method: "POST",
        url: "/api/contacts",
        headers: bearer(token),
        payload: { customerId, siteId, name: "Martine Ferrand", role: "Gardienne" },
      });

    it("refuse de supprimer un site qui porte un contact", async () => {
      const customerId = await createCustomer(api, token);
      const created = (await createSiteRaw({ ...TEST_SITE, customerId })).json<{ id: string }>();
      await addGardien(created.id, customerId);

      const response = await api.inject({
        method: "DELETE",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(409);
    });

    it("refuse de transférer un site dont les contacts suivraient l'ancien client", async () => {
      const customerId = await createCustomer(api, token);
      const autreClient = await createCustomer(api, token, { name: "Cabinet Durand" });
      const created = (await createSiteRaw({ ...TEST_SITE, customerId })).json<{ id: string }>();
      await addGardien(created.id, customerId);

      const response = await api.inject({
        method: "PATCH",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
        payload: { customerId: autreClient },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("isolation entre tenants", () => {
    /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
    const otherTenantToken = (): Promise<string> =>
      api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });

    it("ne laisse pas lire le site d'un autre tenant", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/sites/${created.id}`,
        headers: bearer(await otherTenantToken()),
      });

      expect(response.statusCode).toBe(404);
    });

    it("ne laisse pas supprimer le site d'un autre tenant", async () => {
      const created = (await createSiteRaw()).json<{ id: string }>();

      const deletion = await api.inject({
        method: "DELETE",
        url: `/api/sites/${created.id}`,
        headers: bearer(await otherTenantToken()),
      });
      expect(deletion.statusCode).toBe(404);

      const stillThere = await api.inject({
        method: "GET",
        url: `/api/sites/${created.id}`,
        headers: bearer(token),
      });
      expect(stillThere.statusCode).toBe(200);
    });

    it("ne fait pas fuir un site d'un autre tenant par la recherche", async () => {
      await createSiteRaw();

      const response = await api.inject({
        method: "GET",
        url: "/api/sites?q=lilas",
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });
  });
});
