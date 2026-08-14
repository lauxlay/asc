import { describe, expect, it } from "vitest";
import {
  compareSearchResults,
  MATCH_QUALITIES,
  MAX_SEARCH_RESULTS,
  MIN_SEARCH_LENGTH,
  matchQualityOf,
  type RankedResult,
  rankSearchResults,
  SEARCH_KINDS,
  type SearchKind,
} from "./global-search.js";

/** Spec 010, R1 à R3 — correspondance, classement, plafond. */

describe("matchQualityOf", () => {
  it("reconnaît une égalité", () => {
    expect(matchQualityOf(["OT-2026-00042"], "OT-2026-00042")).toBe("exact");
  });

  it("reconnaît un début de champ", () => {
    expect(matchQualityOf(["Résidence Les Tilleuls"], "résidence")).toBe("prefix");
  });

  it("reconnaît une sous-chaîne", () => {
    expect(matchQualityOf(["Résidence Les Tilleuls"], "tilleuls")).toBe("substring");
  });

  it("ne rend rien quand aucun champ ne correspond", () => {
    expect(matchQualityOf(["Résidence Les Tilleuls"], "acacias")).toBeNull();
  });

  it("garde la meilleure qualité parmi les champs", () => {
    // L'égalité sur le second champ l'emporte sur la sous-chaîne du premier.
    expect(matchQualityOf(["Immeuble des Lilas", "lilas"], "lilas")).toBe("exact");
    expect(matchQualityOf(["Immeuble des Lilas", "Lilas et Cie"], "lilas")).toBe("prefix");
  });

  it("ignore la casse et les accents", () => {
    expect(matchQualityOf(["Église Saint-Jean"], "eglise")).toBe("prefix");
    expect(matchQualityOf(["eglise saint-jean"], "ÉGLISE")).toBe("prefix");
  });

  it("normalise les espaces", () => {
    expect(matchQualityOf(["12   rue des Lilas"], "12 rue")).toBe("prefix");
  });

  it("ignore les champs absents ou vides", () => {
    // Un `null` en base ne doit pas se comporter comme une chaîne vide, qui
    // correspondrait à tout.
    expect(matchQualityOf([null, undefined, ""], "ab")).toBeNull();
    expect(matchQualityOf([null, "Les Tilleuls"], "tilleuls")).toBe("substring");
  });

  describe("longueur minimale", () => {
    it("ne rend rien sur une requête vide", () => {
      expect(matchQualityOf(["Résidence Les Tilleuls"], "")).toBeNull();
    });

    it("ne rend rien sur un seul caractère", () => {
      expect(matchQualityOf(["Résidence Les Tilleuls"], "r")).toBeNull();
      expect(MIN_SEARCH_LENGTH).toBe(2);
    });

    it("ne rend rien sur des espaces seuls", () => {
      expect(matchQualityOf(["Résidence Les Tilleuls"], "   ")).toBeNull();
    });

    it("accepte à partir de deux caractères", () => {
      expect(matchQualityOf(["Résidence Les Tilleuls"], "ré")).toBe("prefix");
    });
  });
});

describe("compareSearchResults", () => {
  const result = (kind: SearchKind, quality: RankedResult["quality"], label: string) => ({
    kind,
    quality,
    label,
  });

  it("classe par qualité avant tout", () => {
    const exact = result("customer", "exact", "Zebre");
    const prefix = result("unit", "prefix", "Ascenseur A");

    expect(compareSearchResults(exact, prefix)).toBeLessThan(0);
  });

  it("respecte l'ordre déclaré des qualités", () => {
    expect(
      compareSearchResults(result("unit", "prefix", "a"), result("unit", "substring", "a")),
    ).toBeLessThan(0);
  });

  it("place l'appareil et l'immeuble devant, à qualité égale", () => {
    expect(
      compareSearchResults(result("unit", "prefix", "z"), result("customer", "prefix", "a")),
    ).toBeLessThan(0);
    expect(
      compareSearchResults(result("site", "prefix", "z"), result("work_order", "prefix", "a")),
    ).toBeLessThan(0);
  });

  it("départage par libellé à qualité et famille égales", () => {
    expect(
      compareSearchResults(
        result("unit", "prefix", "Ascenseur A"),
        result("unit", "prefix", "Ascenseur B"),
      ),
    ).toBeLessThan(0);
  });

  it("range les libellés accentués à leur place", () => {
    // « Église » se classe avec les E, pas après les Z.
    expect(
      compareSearchResults(
        result("site", "prefix", "Église"),
        result("site", "prefix", "Fontaine"),
      ),
    ).toBeLessThan(0);
  });

  it("rend zéro sur deux résultats équivalents", () => {
    expect(
      compareSearchResults(
        result("unit", "prefix", "Ascenseur A"),
        result("unit", "prefix", "Ascenseur A"),
      ),
    ).toBe(0);
  });
});

describe("rankSearchResults", () => {
  const result = (kind: SearchKind, quality: RankedResult["quality"], label: string) => ({
    kind,
    quality,
    label,
  });

  it("ordonne un mélange de familles", () => {
    const ranked = rankSearchResults([
      result("customer", "substring", "Cabinet Dupont"),
      result("work_order", "exact", "OT-2026-00042"),
      result("site", "prefix", "Résidence Les Tilleuls"),
      result("unit", "prefix", "Ascenseur A"),
    ]);

    expect(ranked.map((entry) => entry.label)).toStrictEqual([
      "OT-2026-00042",
      "Ascenseur A",
      "Résidence Les Tilleuls",
      "Cabinet Dupont",
    ]);
  });

  it("plafonne le nombre de résultats", () => {
    const many = Array.from({ length: 50 }, (_value, index) =>
      result("unit", "prefix", `Ascenseur ${String(index).padStart(2, "0")}`),
    );

    expect(rankSearchResults(many)).toHaveLength(MAX_SEARCH_RESULTS);
  });

  it("garde les meilleurs, pas les premiers venus", () => {
    // Le bon résultat arrive en dernier dans l'entrée : sans tri avant
    // plafonnement, il serait coupé.
    const noise = Array.from({ length: MAX_SEARCH_RESULTS }, (_value, index) =>
      result("customer", "substring", `Client ${index}`),
    );
    const ranked = rankSearchResults([...noise, result("unit", "exact", "Ascenseur A")]);

    expect(ranked[0]?.label).toBe("Ascenseur A");
    expect(ranked).toHaveLength(MAX_SEARCH_RESULTS);
  });

  it("ne modifie pas la liste reçue", () => {
    const input = [result("customer", "exact", "b"), result("unit", "exact", "a")];
    rankSearchResults(input);

    expect(input.map((entry) => entry.label)).toStrictEqual(["b", "a"]);
  });

  it("rend une liste vide sans broncher", () => {
    expect(rankSearchResults([])).toStrictEqual([]);
  });

  it("est déterministe", () => {
    const input = [
      result("unit", "prefix", "Ascenseur B"),
      result("unit", "prefix", "Ascenseur A"),
      result("site", "prefix", "Ascenseur A"),
    ];

    expect(rankSearchResults(input)).toStrictEqual(rankSearchResults(input));
  });

  it("couvre toutes les familles et toutes les qualités déclarées", () => {
    // Garde-fou : une famille ou une qualité ajoutée sans rang remonterait ici.
    const ranked = rankSearchResults(
      [...SEARCH_KINDS].reverse().map((kind) => result(kind, "prefix", "même libellé")),
    );

    expect(ranked.map((entry) => entry.kind)).toStrictEqual([...SEARCH_KINDS]);
    expect([...MATCH_QUALITIES]).toStrictEqual(["exact", "prefix", "substring"]);
  });
});
