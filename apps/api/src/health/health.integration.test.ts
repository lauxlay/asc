import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../testing/create-test-app.js";

describe("GET /api/health", () => {
  let api: TestApp;

  beforeEach(async () => {
    api = await createTestApp();
  });

  afterEach(async () => {
    await api.close();
  });

  it("répond sans authentification", async () => {
    // La sonde est appelée par Docker et Dokploy, qui n'ont pas de jeton.
    const response = await api.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>().status).toBe("ok");
  });

  it("expose toute l'API sous le préfixe /api", async () => {
    // Sans préfixe, la racine est réservée au back-office (ADR-002).
    expect((await api.inject({ method: "GET", url: "/health" })).statusCode).toBe(404);
  });
});
