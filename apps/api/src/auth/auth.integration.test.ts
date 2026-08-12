import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bearer, createTestApp, TEST_USER, type TestApp } from "../testing/create-test-app.js";

describe("POST /auth/login", () => {
  let api: TestApp;

  beforeEach(async () => {
    api = await createTestApp();
  });

  afterEach(async () => {
    await api.close();
  });

  const login = (payload: unknown) =>
    api.inject({ method: "POST", url: "/auth/login", payload: payload as object });

  it("rend un jeton utilisable pour les identifiants corrects", async () => {
    const response = await login({ email: TEST_USER.email, password: TEST_USER.password });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ accessToken: string; expiresIn: number; user: unknown }>();
    expect(body.expiresIn).toBe(3600);
    expect(body.user).toStrictEqual({
      id: TEST_USER.id,
      tenantId: "default",
      email: TEST_USER.email,
      role: TEST_USER.role,
    });

    const guarded = await api.inject({
      method: "GET",
      url: "/units",
      headers: bearer(body.accessToken),
    });
    expect(guarded.statusCode).toBe(200);
  });

  it("ne renvoie jamais l'empreinte du mot de passe", async () => {
    const response = await login({ email: TEST_USER.email, password: TEST_USER.password });

    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("scrypt");
  });

  it("accepte un email avec une casse et des espaces différents", async () => {
    const response = await login({
      email: `  ${TEST_USER.email.toUpperCase()}  `,
      password: TEST_USER.password,
    });

    expect(response.statusCode).toBe(200);
  });

  it("refuse un mot de passe faux", async () => {
    const response = await login({ email: TEST_USER.email, password: "mauvais" });

    expect(response.statusCode).toBe(401);
  });

  it("répond exactement pareil pour un email inconnu et un mot de passe faux", async () => {
    const inconnu = await login({ email: "personne@ascenseur.test", password: "peu-importe" });
    const mauvais = await login({ email: TEST_USER.email, password: "mauvais" });

    // Aucune différence exploitable pour énumérer les comptes existants.
    expect(inconnu.statusCode).toBe(mauvais.statusCode);
    expect(inconnu.json()).toStrictEqual(mauvais.json());
  });

  it.each([
    [{ email: "pas-un-email", password: "x" }, "email malformé"],
    [{ email: TEST_USER.email }, "mot de passe manquant"],
    [{ password: "x" }, "email manquant"],
    [{}, "corps vide"],
  ])("refuse une requête invalide (%s)", async (payload, _description) => {
    const response = await login(payload);

    expect(response.statusCode).toBe(400);
    expect(response.json<{ errors: unknown[] }>().errors.length).toBeGreaterThan(0);
  });
});

describe("garde d'authentification", () => {
  let api: TestApp;

  beforeEach(async () => {
    api = await createTestApp();
  });

  afterEach(async () => {
    await api.close();
  });

  it.each([
    [{}, "sans en-tête"],
    [{ authorization: "Bearer pas-un-jeton" }, "jeton illisible"],
    [{ authorization: "Basic abc" }, "mauvais schéma"],
    [{ authorization: "Bearer " }, "jeton vide"],
  ])("refuse l'accès à /units (%s)", async (headers, _description) => {
    const response = await api.inject({ method: "GET", url: "/units", headers });

    expect(response.statusCode).toBe(401);
  });

  it("refuse un jeton signé avec un autre secret", async () => {
    // Jeton bien formé mais signé ailleurs : la signature doit suffire à le rejeter.
    const forged = [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ sub: "x", tenantId: "default" })).toString("base64url"),
      "signature-bidon",
    ].join(".");

    const response = await api.inject({
      method: "GET",
      url: "/units",
      headers: bearer(forged),
    });

    expect(response.statusCode).toBe(401);
  });
});
