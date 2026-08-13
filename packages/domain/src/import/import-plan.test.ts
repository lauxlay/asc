import { describe, expect, it } from "vitest";
import { isoDate } from "../date/iso-date.js";
import type { Site, Unit } from "../entities.js";
import { suggestColumnMapping } from "./column-mapping.js";
import { parseCsv } from "./csv.js";
import { buildImportPlan, siteKeyOf } from "./import-plan.js";

/** Spec 004, R3 à R6 — plan d'import. */

const HEADER = "Immeuble;Adresse;CP;Ville;Repère;Mise en service";

/** Construit un plan depuis un CSV, avec la correspondance devinée. */
function planOf(csv: string, sites: readonly Site[] = [], units: readonly Unit[] = []) {
  const table = parseCsv(csv);
  return buildImportPlan(table, suggestColumnMapping(table.headers), sites, units);
}

function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    id: "site-existant",
    tenantId: "tenant-a",
    customerId: null,
    name: "Résidence Les Tilleuls",
    addressLine: "12 rue des Lilas",
    postalCode: "69003",
    city: "Lyon",
    ...overrides,
  };
}

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "unit-existant",
    tenantId: "tenant-a",
    siteId: "site-existant",
    reference: "Ascenseur A",
    commissionedOn: null,
    lastStatutoryInspectionOn: null,
    ...overrides,
  };
}

describe("plan nominal", () => {
  it("crée un immeuble et son appareil", () => {
    const plan = planOf(`${HEADER}\nTilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;2015-06-01`);

    expect(plan.issues).toStrictEqual([]);
    expect(plan.sites).toHaveLength(1);
    expect(plan.units).toHaveLength(1);
    expect(plan.createdSiteCount).toBe(1);
    expect(plan.reusedSiteCount).toBe(0);
    expect(plan.units[0]?.commissionedOn).toBe(isoDate("2015-06-01"));
  });

  it("laisse les dates absentes à null sans les traiter comme des erreurs", () => {
    const plan = planOf(`${HEADER}\nTilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;`);

    expect(plan.issues).toStrictEqual([]);
    expect(plan.units[0]?.commissionedOn).toBeNull();
  });

  it("relie chaque appareil à son immeuble par la clé d'adresse", () => {
    const plan = planOf(`${HEADER}\nTilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;`);

    expect(plan.units[0]?.siteKey).toBe(plan.sites[0]?.key);
  });
});

/** R3 — regroupement des immeubles. */
describe("regroupement des immeubles", () => {
  it("ne crée qu'un immeuble pour plusieurs appareils à la même adresse", () => {
    const plan = planOf(
      [
        HEADER,
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur B;",
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur C;",
      ].join("\n"),
    );

    expect(plan.sites).toHaveLength(1);
    expect(plan.units).toHaveLength(3);
  });

  it("regroupe malgré la casse et les accents de l'adresse", () => {
    const plan = planOf(
      [
        HEADER,
        "Tilleuls;12 RUE DES LILAS;69003;LYON;Ascenseur A;",
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur B;",
      ].join("\n"),
    );

    expect(plan.sites).toHaveLength(1);
  });

  it("garde le nom de la première ligne du groupe", () => {
    const plan = planOf(
      [
        HEADER,
        "Résidence Les Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
        "Bâtiment B;12 rue des Lilas;69003;Lyon;Ascenseur B;",
      ].join("\n"),
    );

    expect(plan.sites[0]?.name).toBe("Résidence Les Tilleuls");
  });

  it("sépare deux adresses distinctes portant le même nom", () => {
    const plan = planOf(
      [
        HEADER,
        "Les Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
        "Les Tilleuls;8 avenue de la Gare;69100;Villeurbanne;Ascenseur A;",
      ].join("\n"),
    );

    expect(plan.sites).toHaveLength(2);
  });

  it("réutilise un immeuble déjà au parc au lieu de le dupliquer", () => {
    const plan = planOf(`${HEADER}\nPeu importe;12 rue des Lilas;69003;Lyon;Ascenseur Z;`, [
      makeSite(),
    ]);

    expect(plan.sites).toHaveLength(1);
    expect(plan.sites[0]?.existingId).toBe("site-existant");
    expect(plan.createdSiteCount).toBe(0);
    expect(plan.reusedSiteCount).toBe(1);
  });

  it("ne renomme pas un immeuble existant", () => {
    const plan = planOf(`${HEADER}\nNouveau nom;12 rue des Lilas;69003;Lyon;Ascenseur Z;`, [
      makeSite(),
    ]);

    expect(plan.sites[0]?.name).toBe("Résidence Les Tilleuls");
  });
});

/** R4 — validation, tout ou rien. */
describe("validation des lignes", () => {
  it.each([
    [";12 rue des Lilas;69003;Lyon;Ascenseur A;", "nom de l'immeuble"],
    ["Tilleuls;;69003;Lyon;Ascenseur A;", "adresse"],
    ["Tilleuls;12 rue des Lilas;;Lyon;Ascenseur A;", "code postal"],
    ["Tilleuls;12 rue des Lilas;69003;;Ascenseur A;", "ville"],
    ["Tilleuls;12 rue des Lilas;69003;Lyon;;", "repère de l'appareil"],
  ])("refuse une ligne au champ obligatoire vide (%s)", (row, label) => {
    const plan = planOf(`${HEADER}\n${row}`);

    expect(plan.issues).toHaveLength(1);
    expect(plan.issues[0]?.message).toContain(label);
    expect(plan.issues[0]?.lineNumber).toBe(2);
  });

  it("rend toutes les erreurs d'un coup, avec leur numéro de ligne", () => {
    const plan = planOf(
      [
        HEADER,
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
        ";12 rue des Lilas;69003;Lyon;Ascenseur B;",
        "Clos;;44000;Nantes;Ascenseur A;",
      ].join("\n"),
    );

    expect(plan.issues).toHaveLength(2);
    expect(plan.issues.map((issue) => issue.lineNumber)).toStrictEqual([3, 4]);
  });

  it("n'importe rien dès qu'une seule ligne est invalide", () => {
    const plan = planOf(
      [
        HEADER,
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
        "Clos;;44000;Nantes;Ascenseur B;",
      ].join("\n"),
    );

    // Le plan reste consultable pour l'aperçu, mais `issues` non vide interdit
    // toute écriture : c'est l'appelant qui refuse (R4.3).
    expect(plan.issues).not.toStrictEqual([]);
  });

  it("refuse un fichier sans ligne de données", () => {
    const plan = planOf(HEADER);

    expect(plan.issues).toHaveLength(1);
    expect(plan.issues[0]?.lineNumber).toBeNull();
    expect(plan.issues[0]?.message).toContain("aucune ligne de données");
  });

  it("refuse un fichier auquel il manque une colonne obligatoire", () => {
    const plan = planOf("Immeuble;Adresse;CP\nTilleuls;12 rue des Lilas;69003");

    expect(plan.issues.map((issue) => issue.message)).toStrictEqual([
      expect.stringContaining("ville") as unknown as string,
      expect.stringContaining("repère de l'appareil") as unknown as string,
    ]);
    expect(plan.units).toStrictEqual([]);
  });

  it("ne noie pas l'utilisateur sous les erreurs de ligne quand la correspondance est fautive", () => {
    const plan = planOf(["Immeuble;Adresse;CP", "a;b;c", "d;e;f", "g;h;i"].join("\n"));

    // Deux colonnes manquantes, pas six erreurs de lignes.
    expect(plan.issues).toHaveLength(2);
  });
});

/** R5 — doublons d'appareils. */
describe("doublons", () => {
  it("refuse deux fois le même repère dans le même immeuble", () => {
    const plan = planOf(
      [
        HEADER,
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
      ].join("\n"),
    );

    expect(plan.issues).toHaveLength(1);
    expect(plan.issues[0]?.message).toContain("en double dans le fichier");
    expect(plan.issues[0]?.lineNumber).toBe(3);
  });

  it("accepte le même repère dans deux immeubles différents", () => {
    const plan = planOf(
      [
        HEADER,
        "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
        "Clos;8 avenue de la Gare;69100;Villeurbanne;Ascenseur A;",
      ].join("\n"),
    );

    expect(plan.issues).toStrictEqual([]);
    expect(plan.units).toHaveLength(2);
  });

  it("refuse un appareil déjà présent dans le parc", () => {
    const plan = planOf(
      `${HEADER}\nTilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;`,
      [makeSite()],
      [makeUnit()],
    );

    expect(plan.issues).toHaveLength(1);
    expect(plan.issues[0]?.message).toContain("existe déjà");
  });

  it("compare les repères sans tenir compte de la casse", () => {
    const plan = planOf(
      `${HEADER}\nTilleuls;12 rue des Lilas;69003;Lyon;ASCENSEUR A;`,
      [makeSite()],
      [makeUnit()],
    );

    expect(plan.issues).toHaveLength(1);
  });

  it("rend un double import inoffensif", () => {
    const csv = [
      HEADER,
      "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur A;",
      "Tilleuls;12 rue des Lilas;69003;Lyon;Ascenseur B;",
    ].join("\n");

    // Premier import : tout passe.
    expect(planOf(csv).issues).toStrictEqual([]);

    // Second import du même fichier, le parc contenant déjà le résultat.
    const site = makeSite();
    const replay = planOf(
      csv,
      [site],
      [
        makeUnit({ id: "u-1", reference: "Ascenseur A" }),
        makeUnit({ id: "u-2", reference: "Ascenseur B" }),
      ],
    );

    expect(replay.issues).toHaveLength(2);
    expect(replay.units).toStrictEqual([]);
  });

  it("ne considère pas comme doublon un appareil d'un immeuble inconnu du plan", () => {
    const plan = planOf(`${HEADER}\nClos;8 avenue de la Gare;69100;Villeurbanne;Ascenseur A;`, [
      makeSite(),
    ]);

    expect(plan.issues).toStrictEqual([]);
  });
});

/** R6 — dates. */
describe("dates", () => {
  it("accepte le format ISO", () => {
    const plan = planOf(`${HEADER}\nT;12 rue des Lilas;69003;Lyon;A;2015-06-01`);

    expect(plan.units[0]?.commissionedOn).toBe(isoDate("2015-06-01"));
  });

  it("accepte le format français des tableurs", () => {
    const plan = planOf(`${HEADER}\nT;12 rue des Lilas;69003;Lyon;A;01/06/2015`);

    expect(plan.units[0]?.commissionedOn).toBe(isoDate("2015-06-01"));
  });

  it("accepte le 29 février d'une année bissextile", () => {
    const plan = planOf(`${HEADER}\nT;12 rue des Lilas;69003;Lyon;A;29/02/2024`);

    expect(plan.units[0]?.commissionedOn).toBe(isoDate("2024-02-29"));
  });

  it.each([["30/02/2026"], ["2026-02-30"], ["01/13/2015"], ["hier"], ["06/2015"]])(
    "refuse une date impossible (%s)",
    (value) => {
      const plan = planOf(`${HEADER}\nT;12 rue des Lilas;69003;Lyon;A;${value}`);

      expect(plan.issues).toHaveLength(1);
      expect(plan.issues[0]?.message).toContain("Date de mise en service invalide");
    },
  );

  it("lit aussi la date de contrôle technique", () => {
    const table = parseCsv(
      `Immeuble;Adresse;CP;Ville;Repère;Quinquennal\nT;12 rue des Lilas;69003;Lyon;A;15/06/2021`,
    );
    const plan = buildImportPlan(table, suggestColumnMapping(table.headers), [], []);

    expect(plan.units[0]?.lastStatutoryInspectionOn).toBe(isoDate("2021-06-15"));
  });
});

describe("siteKeyOf", () => {
  it("ignore casse, accents et espaces superflus", () => {
    expect(siteKeyOf("  12 RUE DES LILAS ", "69003", "LYON")).toBe(
      siteKeyOf("12 rue des Lilas", "69003", "Lyon"),
    );
  });

  it("distingue deux adresses différentes", () => {
    expect(siteKeyOf("12 rue des Lilas", "69003", "Lyon")).not.toBe(
      siteKeyOf("14 rue des Lilas", "69003", "Lyon"),
    );
  });
});
