import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createTestApp,
  login,
  TEST_USER,
  type TestApp,
} from "../../testing/create-test-app.js";

/** Spec 008, R1 — gestion minimale des utilisateurs. */

const VALID_PASSWORD = "mot-de-passe-initial-2026";

describe("CRUD /users", () => {
  let api: TestApp;
  let token: string;

  beforeEach(async () => {
    api = await createTestApp();
    token = await login(api);
  });

  afterEach(async () => {
    await api.close();
  });

  const createUser = (payload?: unknown) =>
    api.inject({
      method: "POST",
      url: "/api/users",
      headers: bearer(token),
      payload: (payload ?? {
        email: "marc.vidal@ascenseur.test",
        name: "Marc Vidal",
        role: "technician",
        password: VALID_PASSWORD,
      }) as object,
    });

  const patch = (id: string, payload: unknown) =>
    api.inject({
      method: "PATCH",
      url: `/api/users/${id}`,
      headers: bearer(token),
      payload: payload as object,
    });

  const list = () => api.inject({ method: "GET", url: "/api/users", headers: bearer(token) });

  describe("POST /users", () => {
    it("crée un technicien actif", async () => {
      const response = await createUser();

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        email: "marc.vidal@ascenseur.test",
        name: "Marc Vidal",
        role: "technician",
        active: true,
      });
    });

    it("ne rend jamais le mot de passe, ni en clair ni haché", async () => {
      const response = await createUser();

      const body = response.json<Record<string, unknown>>();
      expect(body).not.toHaveProperty("password");
      expect(body).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(body)).not.toContain(VALID_PASSWORD);
    });

    it("refuse un mot de passe trop court", async () => {
      const response = await createUser({
        email: "court@ascenseur.test",
        name: "Trop Court",
        role: "technician",
        password: "12345678901",
      });

      expect(response.statusCode).toBe(400);
    });

    it("refuse un email déjà utilisé, quelle que soit la casse", async () => {
      await createUser();
      const response = await createUser({
        email: "Marc.Vidal@Ascenseur.TEST",
        name: "Marc Vidal bis",
        role: "technician",
        password: VALID_PASSWORD,
      });

      expect(response.statusCode).toBe(409);
    });

    it("refuse un rôle inconnu", async () => {
      const response = await createUser({
        email: "role@ascenseur.test",
        name: "Rôle Inconnu",
        role: "concierge",
        password: VALID_PASSWORD,
      });

      expect(response.statusCode).toBe(400);
    });

    it("laisse le nouveau compte se connecter avec son mot de passe initial", async () => {
      await createUser();

      const response = await api.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "marc.vidal@ascenseur.test", password: VALID_PASSWORD },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ user: { role: string } }>().user.role).toBe("technician");
    });
  });

  describe("GET /users", () => {
    it("rend le dispatcher du seed et les comptes créés", async () => {
      await createUser();

      const emails = list()
        .then((response) => response.json<{ items: { email: string }[] }>().items)
        .then((items) => items.map((item) => item.email).sort());

      expect(await emails).toStrictEqual([
        "dispatcher@ascenseur.test",
        "marc.vidal@ascenseur.test",
      ]);
    });

    it("ne laisse fuir aucune empreinte de mot de passe", async () => {
      await createUser();

      const response = await list();

      expect(response.body).not.toContain("scrypt$");
      expect(response.body).not.toContain("passwordHash");
    });

    it("garde visibles les comptes désactivés", async () => {
      const id = (await createUser()).json<{ id: string }>().id;
      await patch(id, { active: false });

      const items = (await list()).json<{ items: { id: string; active: boolean }[] }>().items;

      expect(items.find((item) => item.id === id)?.active).toBe(false);
    });
  });

  describe("PATCH /users/:id", () => {
    it("désactive puis réactive un compte", async () => {
      const id = (await createUser()).json<{ id: string }>().id;

      expect((await patch(id, { active: false })).json<{ active: boolean }>().active).toBe(false);
      expect((await patch(id, { active: true })).json<{ active: boolean }>().active).toBe(true);
    });

    it("empêche un compte désactivé de se connecter, sans dire pourquoi", async () => {
      const id = (await createUser()).json<{ id: string }>().id;
      await patch(id, { active: false });

      const response = await api.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "marc.vidal@ascenseur.test", password: VALID_PASSWORD },
      });

      expect(response.statusCode).toBe(401);
      // Exactement le message d'un email inconnu : rien ne distingue les deux.
      expect(response.json<{ message: string }>().message).toBe("Identifiants invalides");
    });

    it("refuse qu'on se désactive soi-même", async () => {
      const response = await patch(TEST_USER.id, { active: false });

      expect(response.statusCode).toBe(422);
    });

    it("laisse corriger un nom", async () => {
      const id = (await createUser()).json<{ id: string }>().id;

      expect((await patch(id, { name: "Marc Vidal-Roux" })).json<{ name: string }>().name).toBe(
        "Marc Vidal-Roux",
      );
    });

    it("ignore l'email et le rôle qu'on tenterait de changer", async () => {
      const id = (await createUser()).json<{ id: string }>().id;

      const response = await patch(id, { email: "autre@ascenseur.test", role: "admin" });

      expect(response.json()).toMatchObject({
        email: "marc.vidal@ascenseur.test",
        role: "technician",
      });
    });

    it("rend 404 sur un utilisateur inconnu", async () => {
      expect((await patch("inconnu", { active: false })).statusCode).toBe(404);
    });
  });

  describe("isolation multi-tenant", () => {
    /** Jeton valide, signé par le serveur, mais portant un autre tenant. */
    const otherTenantToken = (): Promise<string> =>
      api.jwt.signAsync({
        sub: "autre-utilisateur",
        tenantId: "tenant-b",
        email: "autre@ascenseur.test",
        role: TEST_USER.role,
      });

    it("ne montre pas les utilisateurs d'un autre tenant", async () => {
      await createUser();

      const response = await api.inject({
        method: "GET",
        url: "/api/users",
        headers: bearer(await otherTenantToken()),
      });

      expect(response.json<{ items: unknown[] }>().items).toStrictEqual([]);
    });

    it("traite un utilisateur d'un autre tenant comme inconnu", async () => {
      const id = (await createUser()).json<{ id: string }>().id;

      const response = await api.inject({
        method: "PATCH",
        url: `/api/users/${id}`,
        headers: bearer(await otherTenantToken()),
        payload: { active: false },
      });

      expect(response.statusCode).toBe(404);
    });

    it("laisse le même email exister dans deux tenants", async () => {
      await createUser();

      const response = await api.inject({
        method: "POST",
        url: "/api/users",
        headers: bearer(await otherTenantToken()),
        payload: {
          email: "marc.vidal@ascenseur.test",
          name: "Marc Vidal",
          role: "technician",
          password: VALID_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  it("exige un jeton", async () => {
    expect((await api.inject({ method: "GET", url: "/api/users" })).statusCode).toBe(401);
  });
});
