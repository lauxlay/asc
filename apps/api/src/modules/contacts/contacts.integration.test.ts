import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createCustomer,
  createSite,
  createTestApp,
  login,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("CRUD /contacts", () => {
  let api: TestApp;
  let token: string;
  let customerId: string;
  /** Immeuble rattaché à `customerId` — le cas du gardien (spec 003, R2.2). */
  let siteId: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
    customerId = await createCustomer(api, token);
    siteId = await createSite(api, token, { customerId });
  });

  afterEach(async () => {
    await api.close();
  });

  const createContact = (payload?: unknown) =>
    api.inject({
      method: "POST",
      url: "/api/contacts",
      headers: bearer(token),
      payload: (payload ?? {
        customerId,
        name: "Martine Ferrand",
        role: "Gestionnaire",
      }) as object,
    });

  /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
  const otherTenantToken = (): Promise<string> =>
    api.jwt.signAsync({
      sub: "autre-utilisateur",
      tenantId: "tenant-b",
      email: "autre@ascenseur.test",
      role: TEST_USER.role,
    });

  describe("POST /contacts", () => {
    it("crée un contact de client, sans immeuble", async () => {
      const response = await createContact();

      expect(response.statusCode).toBe(201);
      expect(response.json()).toStrictEqual({
        id: expect.stringMatching(UUID_PATTERN) as unknown,
        tenantId: "default",
        customerId,
        siteId: null,
        name: "Martine Ferrand",
        role: "Gestionnaire",
        email: null,
        phone: null,
      });
    });

    it("crée un gardien rattaché à un immeuble du même client", async () => {
      const response = await createContact({
        customerId,
        siteId,
        name: "Martine Ferrand",
        role: "Gardienne",
        phone: "0400000000",
      });

      expect(response.statusCode).toBe(201);
      const contact = response.json<{ siteId: string; phone: string; role: string }>();
      expect(contact.siteId).toBe(siteId);
      expect(contact.phone).toBe("0400000000");
      expect(contact.role).toBe("Gardienne");
    });

    it("accepte un rôle en texte libre", async () => {
      const response = await createContact({
        customerId,
        name: "Jean Blanc",
        role: "Président du conseil syndical",
      });

      expect(response.json<{ role: string }>().role).toBe("Président du conseil syndical");
    });

    it("ramène une coordonnée vide à null plutôt qu'à une chaîne vide", async () => {
      const contact = (
        await createContact({ customerId, name: "Jean Blanc", role: "Gestionnaire", email: "  " })
      ).json<{ email: unknown }>();

      expect(contact.email).toBeNull();
    });

    it.each([
      [{ name: "Sans client", role: "Gardien" }, "customerId manquant"],
      [{ customerId: "", name: "N", role: "R" }, "customerId vide"],
      [{ customerId: "x", role: "Gardien" }, "nom manquant"],
      [{ customerId: "x", name: "N" }, "rôle manquant"],
      [{ customerId: "x", name: "N", role: "" }, "rôle vide"],
      [{}, "corps vide"],
    ])("refuse une requête invalide (%s)", async (payload, _description) => {
      // `customerId: "x"` est remplacé par un identifiant réel : ces cas
      // testent la validation de forme, pas l'intégrité référentielle.
      const body = { ...payload } as Record<string, unknown>;
      if (body.customerId === "x") {
        body.customerId = customerId;
      }

      expect((await createContact(body)).statusCode).toBe(400);
    });
  });

  /** Spec 003, R2 — intégrité du rattachement. */
  describe("rattachement client et immeuble", () => {
    it("refuse un customerId qui ne désigne aucun client", async () => {
      const response = await createContact({
        customerId: "client-inexistant",
        name: "N",
        role: "R",
      });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un client appartenant à un autre tenant, comme s'il était inconnu", async () => {
      const intruder = await otherTenantToken();
      const foreignCustomer = await createCustomer(api, intruder, { name: "Client d'un autre" });

      const response = await createContact({ customerId: foreignCustomer, name: "N", role: "R" });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un immeuble inexistant", async () => {
      const response = await createContact({
        customerId,
        siteId: "site-inexistant",
        name: "N",
        role: "R",
      });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un immeuble rattaché à un autre client", async () => {
      const autreClient = await createCustomer(api, token, { name: "Cabinet Durand" });
      const siteDeLAutre = await createSite(api, token, { customerId: autreClient });

      const response = await createContact({
        customerId,
        siteId: siteDeLAutre,
        name: "N",
        role: "R",
      });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un immeuble sans client", async () => {
      const orphelin = await createSite(api, token, { name: "Immeuble sans syndic" });

      const response = await createContact({ customerId, siteId: orphelin, name: "N", role: "R" });

      expect(response.statusCode).toBe(400);
    });

    it("revalide le couple quand seul le client change", async () => {
      const created = (await createContact({ customerId, siteId, name: "N", role: "R" })).json<{
        id: string;
      }>();
      const autreClient = await createCustomer(api, token, { name: "Cabinet Durand" });

      const response = await api.inject({
        method: "PATCH",
        url: `/api/contacts/${created.id}`,
        headers: bearer(token),
        payload: { customerId: autreClient },
      });

      // L'immeuble resterait celui du client précédent : R2.2 l'interdit.
      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /contacts", () => {
    it("filtre par client", async () => {
      await createContact();
      const autreClient = await createCustomer(api, token, { name: "Cabinet Durand" });
      await createContact({ customerId: autreClient, name: "Autre", role: "Gestionnaire" });

      const response = await api.inject({
        method: "GET",
        url: `/api/contacts?customerId=${autreClient}`,
        headers: bearer(token),
      });

      const items = response.json<{ items: { name: string }[] }>().items;
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe("Autre");
    });

    it("filtre par immeuble", async () => {
      await createContact();
      await createContact({ customerId, siteId, name: "La gardienne", role: "Gardienne" });

      const response = await api.inject({
        method: "GET",
        url: `/api/contacts?siteId=${siteId}`,
        headers: bearer(token),
      });

      const items = response.json<{ items: { name: string }[] }>().items;
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe("La gardienne");
    });

    it("rend tous les contacts du tenant sans filtre", async () => {
      await createContact();
      await createContact({ customerId, name: "Jean Blanc", role: "Gestionnaire" });

      const response = await api.inject({
        method: "GET",
        url: "/api/contacts",
        headers: bearer(token),
      });

      expect(response.json<{ items: unknown[] }>().items).toHaveLength(2);
    });

    it("répond 404 pour un contact inconnu", async () => {
      const response = await api.inject({
        method: "GET",
        url: "/api/contacts/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /contacts/:id", () => {
    it("ne modifie que les champs fournis", async () => {
      const created = (await createContact()).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/contacts/${created.id}`,
        headers: bearer(token),
        payload: { phone: "0611223344" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toStrictEqual({
        id: created.id,
        tenantId: "default",
        customerId,
        siteId: null,
        name: "Martine Ferrand",
        role: "Gestionnaire",
        email: null,
        phone: "0611223344",
      });
    });

    it("permet de détacher le contact de son immeuble", async () => {
      const created = (
        await createContact({ customerId, siteId, name: "N", role: "Gardienne" })
      ).json<{ id: string }>();

      const response = await api.inject({
        method: "PATCH",
        url: `/api/contacts/${created.id}`,
        headers: bearer(token),
        payload: { siteId: null },
      });

      expect(response.json<{ siteId: unknown }>().siteId).toBeNull();
    });

    it("répond 404 pour un contact inconnu", async () => {
      const response = await api.inject({
        method: "PATCH",
        url: "/api/contacts/inconnu",
        headers: bearer(token),
        payload: { name: "Nouveau" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /contacts/:id", () => {
    it("supprime le contact", async () => {
      const created = (await createContact()).json<{ id: string }>();

      const deleted = await api.inject({
        method: "DELETE",
        url: `/api/contacts/${created.id}`,
        headers: bearer(token),
      });
      expect(deleted.statusCode).toBe(204);

      const reread = await api.inject({
        method: "GET",
        url: `/api/contacts/${created.id}`,
        headers: bearer(token),
      });
      expect(reread.statusCode).toBe(404);
    });

    it("répond 404 pour un contact inconnu", async () => {
      const response = await api.inject({
        method: "DELETE",
        url: "/api/contacts/inconnu",
        headers: bearer(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("isolation entre tenants", () => {
    it("ne laisse pas lire le contact d'un autre tenant", async () => {
      const created = (await createContact()).json<{ id: string }>();

      const response = await api.inject({
        method: "GET",
        url: `/api/contacts/${created.id}`,
        headers: bearer(await otherTenantToken()),
      });

      expect(response.statusCode).toBe(404);
    });

    it("ne mélange pas les listes de deux tenants", async () => {
      await createContact();

      const response = await api.inject({
        method: "GET",
        url: "/api/contacts",
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });
  });
});
