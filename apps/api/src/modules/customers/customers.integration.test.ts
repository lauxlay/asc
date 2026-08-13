import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createCustomer,
  createSite,
  createTestApp,
  login,
  TEST_CUSTOMER,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("CRUD /customers", () => {
  let api: TestApp;
  let token: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
  });

  afterEach(async () => {
    await api.close();
  });

  const createCustomerRaw = (payload: unknown = TEST_CUSTOMER) =>
    api.inject({
      method: "POST",
      url: "/api/customers",
      headers: bearer(token),
      payload: payload as object,
    });

  /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
  const otherTenantToken = (): Promise<string> =>
    api.jwt.signAsync({
      sub: "autre-utilisateur",
      tenantId: "tenant-b",
      email: "autre@ascenseur.test",
      role: TEST_USER.role,
    });

  describe("POST /customers", () => {
    it("crée un client avec un UUID applicatif et le tenant du jeton", async () => {
      const response = await createCustomerRaw();

      expect(response.statusCode).toBe(201);
      expect(response.json()).toStrictEqual({
        id: expect.stringMatching(UUID_PATTERN) as unknown,
        tenantId: "default",
        ...TEST_CUSTOMER,
      });
    });

    it.each([["managing_agent"], ["condominium"], ["business"], ["individual"]])(
      "accepte le type %s",
      async (type) => {
        const response = await createCustomerRaw({ name: "Client", type });

        expect(response.statusCode).toBe(201);
        expect(response.json<{ type: string }>().type).toBe(type);
      },
    );

    it("ignore un id et un tenantId envoyés par le client", async () => {
      const customer = (
        await createCustomerRaw({
          ...TEST_CUSTOMER,
          id: "id-choisi-par-le-client",
          tenantId: "tenant-pirate",
        })
      ).json<{ id: string; tenantId: string }>();

      expect(customer.id).not.toBe("id-choisi-par-le-client");
      expect(customer.tenantId).toBe("default");
    });

    it.each([
      [{ ...TEST_CUSTOMER, name: "" }, "nom vide"],
      [{ ...TEST_CUSTOMER, name: "   " }, "nom d'espaces"],
      [{ name: "Sans type" }, "type manquant"],
      [{ ...TEST_CUSTOMER, type: "syndic" }, "type hors énumération"],
      [{}, "corps vide"],
    ])("refuse une requête invalide (%s)", async (payload, _description) => {
      expect((await createCustomerRaw(payload)).statusCode).toBe(400);
    });
  });

  describe("GET /customers", () => {
    it("rend une liste vide quand le portefeuille est vide", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/customers",
        headers: bearer(token),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("liste les clients du tenant dans l'ordre d'insertion", async () => {
      await createCustomerRaw({ name: "Client A", type: "managing_agent" });
      await createCustomerRaw({ name: "Client B", type: "condominium" });

      const response = await api.inject({
        method: "GET",
        url: "/api/customers",
        headers: bearer(token),
      });

      expect(response.json<{ items: { name: string }[] }>().items.map((c) => c.name)).toStrictEqual(
        ["Client A", "Client B"],
      );
    });

    it("répond 404 pour un client inconnu", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/customers/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /customers/:id", () => {
    it("ne modifie que les champs fournis", async () => {
      const id = await createCustomer(api, token);

      const response = await api.inject({
        method: "PATCH",
        url: `/api/customers/${id}`,
        headers: bearer(token),
        payload: { type: "condominium" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toStrictEqual({
        id,
        tenantId: "default",
        name: TEST_CUSTOMER.name,
        type: "condominium",
      });
    });

    it("répond 404 pour un client inconnu", async () => {
      const response = await api.inject({
        method: "PATCH",
        url: "/api/customers/inconnu",
        headers: bearer(token),
        payload: { name: "Nouveau nom" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  /** Spec 003, R3 — pas de destruction implicite en cascade. */
  describe("DELETE /customers/:id", () => {
    const addContact = (customerId: string, siteId: string | null = null) =>
      api.inject({
        method: "POST",
        url: "/api/contacts",
        headers: bearer(token),
        payload: { customerId, siteId, name: "Martine Ferrand", role: "Gardienne" },
      });

    it("supprime un client sans immeuble ni contact", async () => {
      const id = await createCustomer(api, token);

      const response = await api.inject({
        method: "DELETE",
        url: `/api/customers/${id}`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(204);
    });

    it("refuse de supprimer un client encore rattaché à un immeuble", async () => {
      const customerId = await createCustomer(api, token);
      await createSite(api, token, { customerId });

      const response = await api.inject({
        method: "DELETE",
        url: `/api/customers/${customerId}`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(409);
    });

    it("refuse de supprimer un client qui porte un contact", async () => {
      const customerId = await createCustomer(api, token);
      await addContact(customerId);

      const response = await api.inject({
        method: "DELETE",
        url: `/api/customers/${customerId}`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(409);
    });

    it("redevient supprimable une fois l'immeuble détaché", async () => {
      const customerId = await createCustomer(api, token);
      const siteId = await createSite(api, token, { customerId });

      await api.inject({
        method: "PATCH",
        url: `/api/sites/${siteId}`,
        headers: bearer(token),
        payload: { customerId: null },
      });

      const response = await api.inject({
        method: "DELETE",
        url: `/api/customers/${customerId}`,
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(204);
    });

    it("répond 404 pour un client inconnu", async () => {
      const response = await api.inject({
        method: "DELETE",
        url: "/api/customers/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("isolation entre tenants", () => {
    it("ne laisse pas lire le client d'un autre tenant", async () => {
      const id = await createCustomer(api, token);

      const response = await api.inject({
        method: "GET",
        url: `/api/customers/${id}`,
        headers: bearer(await otherTenantToken()),
      });

      expect(response.statusCode).toBe(404);
    });

    it("ne mélange pas les portefeuilles de deux tenants", async () => {
      await createCustomer(api, token);

      const response = await api.inject({
        method: "GET",
        url: "/api/customers",
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("ne laisse pas supprimer le client d'un autre tenant", async () => {
      const id = await createCustomer(api, token);

      const deletion = await api.inject({
        method: "DELETE",
        url: `/api/customers/${id}`,
        headers: bearer(await otherTenantToken()),
      });
      expect(deletion.statusCode).toBe(404);

      const stillThere = await api.inject({
        method: "GET",
        url: `/api/customers/${id}`,
        headers: bearer(token),
      });
      expect(stillThere.statusCode).toBe(200);
    });
  });
});
