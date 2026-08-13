import { describe, expect, it } from "vitest";
import {
  type ColumnMapping,
  duplicatedColumns,
  missingRequiredFields,
  suggestColumnMapping,
} from "./column-mapping.js";

/** Spec 004, R2 — correspondance assistée des colonnes. */

const NOTHING_MAPPED: ColumnMapping = {
  siteName: null,
  addressLine: null,
  postalCode: null,
  city: null,
  reference: null,
  commissionedOn: null,
  lastStatutoryInspectionOn: null,
};

describe("suggestColumnMapping", () => {
  it("reconnaît un en-tête d'export courant", () => {
    const mapping = suggestColumnMapping([
      "Immeuble",
      "Adresse",
      "Code postal",
      "Ville",
      "N° appareil",
      "Mise en service",
    ]);

    expect(mapping).toStrictEqual({
      siteName: 0,
      addressLine: 1,
      postalCode: 2,
      city: 3,
      reference: 4,
      commissionedOn: 5,
      lastStatutoryInspectionOn: null,
    });
  });

  it("ignore la casse, les accents et les espaces superflus", () => {
    const mapping = suggestColumnMapping(["  RÉSIDENCE  ", "COMMUNE", "Repère"]);

    expect(mapping.siteName).toBe(0);
    expect(mapping.city).toBe(1);
    expect(mapping.reference).toBe(2);
  });

  it.each([
    ["immeuble", "siteName"],
    ["residence", "siteName"],
    ["bâtiment", "siteName"],
    ["adresse", "addressLine"],
    ["rue", "addressLine"],
    ["cp", "postalCode"],
    ["code postal", "postalCode"],
    ["ville", "city"],
    ["localité", "city"],
    ["repère", "reference"],
    ["ascenseur", "reference"],
    ["référence", "reference"],
    ["mise en service", "commissionedOn"],
    ["contrôle technique", "lastStatutoryInspectionOn"],
    ["quinquennal", "lastStatutoryInspectionOn"],
  ])("reconnaît « %s » comme %s", (header, field) => {
    const mapping = suggestColumnMapping([header]);

    expect(mapping[field as keyof ColumnMapping]).toBe(0);
  });

  it("laisse à null ce qu'il ne reconnaît pas", () => {
    const mapping = suggestColumnMapping(["colonne mystère", "autre chose"]);

    expect(mapping).toStrictEqual(NOTHING_MAPPED);
  });

  it("ignore sans bruit les colonnes en trop d'un export fourni", () => {
    const mapping = suggestColumnMapping([
      "Code interne",
      "Immeuble",
      "Adresse",
      "CP",
      "Ville",
      "Repère",
      "Marque",
      "Tonnage",
    ]);

    expect(mapping.siteName).toBe(1);
    expect(mapping.reference).toBe(5);
    expect(missingRequiredFields(mapping)).toStrictEqual([]);
  });

  it("n'affecte jamais deux fois la même colonne", () => {
    // « nom » pourrait tomber sur siteName, mais la colonne 0 est déjà prise.
    const mapping = suggestColumnMapping(["Immeuble", "Nom"]);

    expect(mapping.siteName).toBe(0);
    expect(duplicatedColumns(mapping)).toStrictEqual([]);
  });

  it("préfère l'intitulé le plus spécifique au plus vague", () => {
    const mapping = suggestColumnMapping(["Nom", "Résidence"]);

    expect(mapping.siteName).toBe(1);
  });

  it("est déterministe", () => {
    const headers = ["Immeuble", "Adresse", "CP", "Ville", "Repère"];

    expect(suggestColumnMapping(headers)).toStrictEqual(suggestColumnMapping(headers));
  });
});

describe("missingRequiredFields", () => {
  it("liste les cinq champs obligatoires quand rien n'est affecté", () => {
    expect(missingRequiredFields(NOTHING_MAPPED)).toStrictEqual([
      "siteName",
      "addressLine",
      "postalCode",
      "city",
      "reference",
    ]);
  });

  it("ne réclame pas les dates, facultatives", () => {
    const mapping = suggestColumnMapping(["Immeuble", "Adresse", "CP", "Ville", "Repère"]);

    expect(missingRequiredFields(mapping)).toStrictEqual([]);
  });
});

describe("duplicatedColumns", () => {
  it("repère une colonne affectée à deux champs", () => {
    const mapping: ColumnMapping = { ...NOTHING_MAPPED, siteName: 2, city: 2 };

    expect(duplicatedColumns(mapping)).toStrictEqual([2]);
  });

  it("ne signale rien quand chaque champ a sa colonne", () => {
    const mapping: ColumnMapping = { ...NOTHING_MAPPED, siteName: 0, city: 1 };

    expect(duplicatedColumns(mapping)).toStrictEqual([]);
  });
});
