import { describe, expect, it } from "vitest";
import type { Site } from "../entities.js";
import { normalizeSearchText, siteMatchesQuery } from "./site-search.js";

/** Spec 002, R2 — recherche de sites par adresse. */

function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    id: "site-1",
    tenantId: "tenant-a",
    name: "Résidence Les Tilleuls",
    addressLine: "12 rue des Lilas",
    postalCode: "69003",
    city: "Lyon",
    ...overrides,
  };
}

describe("normalizeSearchText", () => {
  it("met en minuscules", () => {
    expect(normalizeSearchText("LILAS")).toBe("lilas");
  });

  it("retire les diacritiques", () => {
    expect(normalizeSearchText("Église")).toBe("eglise");
    expect(normalizeSearchText("Bâtiment Süd")).toBe("batiment sud");
    expect(normalizeSearchText("Nôtre-Dame")).toBe("notre-dame");
  });

  it("réduit les espaces multiples et coupe les bords", () => {
    expect(normalizeSearchText("  12   rue  des   Lilas  ")).toBe("12 rue des lilas");
  });

  it("traite tabulations et retours à la ligne comme des espaces", () => {
    expect(normalizeSearchText("12\true\ndes lilas")).toBe("12 rue des lilas");
  });

  it("rend une chaîne vide pour une entrée vide ou blanche", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText("   ")).toBe("");
  });

  it("est idempotente", () => {
    const once = normalizeSearchText("  Église   Saint-Jean ");
    expect(normalizeSearchText(once)).toBe(once);
  });
});

describe("siteMatchesQuery", () => {
  it("trouve par nom", () => {
    expect(siteMatchesQuery(makeSite(), "tilleuls")).toBe(true);
  });

  it("trouve par voie", () => {
    expect(siteMatchesQuery(makeSite(), "rue des lilas")).toBe(true);
  });

  it("trouve par code postal", () => {
    expect(siteMatchesQuery(makeSite(), "69003")).toBe(true);
  });

  it("trouve par ville", () => {
    expect(siteMatchesQuery(makeSite(), "lyon")).toBe(true);
  });

  it("ignore la casse de la requête comme de la donnée", () => {
    expect(siteMatchesQuery(makeSite(), "LILAS")).toBe(true);
    expect(siteMatchesQuery(makeSite({ city: "SAINT-ÉTIENNE" }), "saint-etienne")).toBe(true);
  });

  it("ignore les accents dans les deux sens", () => {
    const site = makeSite({ name: "Résidence de l'Église" });

    expect(siteMatchesQuery(site, "eglise")).toBe(true);
    expect(siteMatchesQuery(makeSite({ name: "Residence" }), "Résidence")).toBe(true);
  });

  it("ignore les espaces superflus de la requête", () => {
    expect(siteMatchesQuery(makeSite(), "  12   rue  ")).toBe(true);
  });

  it("correspond sur une sous-chaîne, pas seulement un mot entier", () => {
    expect(siteMatchesQuery(makeSite(), "ill")).toBe(true);
  });

  it("rend true pour une requête vide, absente de contenu ou blanche", () => {
    expect(siteMatchesQuery(makeSite(), "")).toBe(true);
    expect(siteMatchesQuery(makeSite(), "   ")).toBe(true);
  });

  it("rend false quand rien ne correspond", () => {
    expect(siteMatchesQuery(makeSite(), "marseille")).toBe(false);
  });

  it("ne rapproche pas deux champs distincts par concaténation", () => {
    // « lilas69003 » ne doit pas correspondre : les champs sont balayés
    // séparément, pas collés bout à bout.
    expect(siteMatchesQuery(makeSite(), "lilas69003")).toBe(false);
  });
});
