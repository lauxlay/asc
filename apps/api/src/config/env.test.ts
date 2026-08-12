import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

const VALID_SECRET = "un-secret-de-test-suffisamment-long-32";

describe("loadConfig", () => {
  it("applique les valeurs par défaut", () => {
    const config = loadConfig({ JWT_SECRET: VALID_SECRET });

    expect(config.PORT).toBe(3000);
    expect(config.DATA_DIR).toBe("./data");
    expect(config.JWT_EXPIRES_IN).toBe(28_800);
  });

  it("convertit les nombres venus de l'environnement", () => {
    const config = loadConfig({ JWT_SECRET: VALID_SECRET, PORT: "8080", JWT_EXPIRES_IN: "900" });

    expect(config.PORT).toBe(8080);
    expect(config.JWT_EXPIRES_IN).toBe(900);
  });

  it("refuse de démarrer sans secret de signature", () => {
    // Aucune valeur par défaut pour JWT_SECRET : un déploiement mal configuré
    // doit échouer au démarrage, pas signer des jetons avec un secret connu.
    expect(() => loadConfig({})).toThrow(/JWT_SECRET/);
  });

  it("refuse un secret trop court", () => {
    expect(() => loadConfig({ JWT_SECRET: "trop-court" })).toThrow(/au moins 32/);
  });

  it.each([
    [{ PORT: "zéro" }, "port non numérique"],
    [{ PORT: "0" }, "port nul"],
    [{ PORT: "-1" }, "port négatif"],
    [{ JWT_EXPIRES_IN: "0" }, "durée nulle"],
  ])("refuse une configuration invalide (%s)", (overrides, _description) => {
    expect(() => loadConfig({ JWT_SECRET: VALID_SECRET, ...overrides })).toThrow(
      /Configuration invalide/,
    );
  });
});
