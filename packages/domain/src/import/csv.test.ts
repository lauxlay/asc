import { describe, expect, it } from "vitest";
import { DomainError } from "../errors.js";
import { parseCsv } from "./csv.js";

/** Spec 004, R1 — lecture d'un CSV tel qu'Excel le produit. */

describe("parseCsv", () => {
  describe("séparateur", () => {
    it("détecte le point-virgule des tableurs francophones", () => {
      const table = parseCsv("immeuble;ville\nTilleuls;Lyon");

      expect(table.separator).toBe(";");
      expect(table.headers).toStrictEqual(["immeuble", "ville"]);
    });

    it("détecte la virgule", () => {
      const table = parseCsv("immeuble,ville\nTilleuls,Lyon");

      expect(table.separator).toBe(",");
      expect(table.headers).toStrictEqual(["immeuble", "ville"]);
    });

    it("choisit celui qui découpe le plus de colonnes", () => {
      // Une virgule dans une valeur ne doit pas l'emporter sur le vrai séparateur.
      const table = parseCsv("immeuble;adresse;ville\nTilleuls;12, rue des Lilas;Lyon");

      expect(table.separator).toBe(";");
      expect(table.rows[0]?.cells).toStrictEqual(["Tilleuls", "12, rue des Lilas", "Lyon"]);
    });

    it("accepte un fichier à une seule colonne", () => {
      const table = parseCsv("immeuble\nTilleuls");

      expect(table.headers).toStrictEqual(["immeuble"]);
      expect(table.rows).toHaveLength(1);
    });
  });

  describe("robustesse du format", () => {
    it("retire le BOM sans polluer la première colonne", () => {
      const table = parseCsv("﻿immeuble;ville\nTilleuls;Lyon");

      expect(table.headers[0]).toBe("immeuble");
    });

    it("accepte CRLF, LF et CR", () => {
      for (const eol of ["\r\n", "\n", "\r"]) {
        const table = parseCsv(`immeuble;ville${eol}Tilleuls;Lyon${eol}Clos;Nantes`);

        expect(table.rows).toHaveLength(2);
        expect(table.rows[1]?.cells).toStrictEqual(["Clos", "Nantes"]);
      }
    });

    it("lit un champ entre guillemets contenant le séparateur", () => {
      const table = parseCsv('immeuble;adresse\nTilleuls;"12; rue des Lilas"');

      expect(table.rows[0]?.cells[1]).toBe("12; rue des Lilas");
    });

    it("lit un champ entre guillemets contenant un retour à la ligne", () => {
      const table = parseCsv('immeuble;adresse\nTilleuls;"12 rue des Lilas\nBâtiment B"');

      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]?.cells[1]).toBe("12 rue des Lilas\nBâtiment B");
    });

    it("rend un guillemet doublé comme un guillemet littéral", () => {
      const table = parseCsv('immeuble;nom\nTilleuls;"Le ""Clos"" Fleuri"');

      expect(table.rows[0]?.cells[1]).toBe('Le "Clos" Fleuri');
    });

    it("ignore les lignes vides, y compris en fin de fichier", () => {
      const table = parseCsv("immeuble;ville\n\nTilleuls;Lyon\n\n\nClos;Nantes\n\n");

      expect(table.rows).toHaveLength(2);
    });

    it("retire les espaces de bord de chaque cellule", () => {
      const table = parseCsv("  immeuble  ;  ville  \n  Tilleuls  ;  Lyon  ");

      expect(table.headers).toStrictEqual(["immeuble", "ville"]);
      expect(table.rows[0]?.cells).toStrictEqual(["Tilleuls", "Lyon"]);
    });

    it("complète une ligne plus courte que l'en-tête", () => {
      const table = parseCsv("immeuble;adresse;ville\nTilleuls;12 rue des Lilas");

      expect(table.rows[0]?.cells).toStrictEqual(["Tilleuls", "12 rue des Lilas", ""]);
    });

    it("ignore les colonnes en trop d'une ligne trop longue", () => {
      const table = parseCsv("immeuble;ville\nTilleuls;Lyon;en trop");

      expect(table.rows[0]?.cells).toStrictEqual(["Tilleuls", "Lyon"]);
    });

    it("lit la dernière ligne même sans fin de ligne finale", () => {
      const table = parseCsv("immeuble;ville\nTilleuls;Lyon");

      expect(table.rows).toHaveLength(1);
    });
  });

  describe("numéro de ligne", () => {
    it("suit le fichier, en comptant l'en-tête comme ligne 1", () => {
      const table = parseCsv("immeuble;ville\nTilleuls;Lyon\nClos;Nantes");

      expect(table.rows.map((row) => row.lineNumber)).toStrictEqual([2, 3]);
    });

    it("ne décale pas la numérotation à cause des lignes vides", () => {
      // La ligne 4 du tableur reste la ligne 4 dans le message d'erreur.
      const table = parseCsv("immeuble;ville\n\nTilleuls;Lyon");

      expect(table.rows[0]?.lineNumber).toBe(3);
    });
  });

  describe("fichier inexploitable", () => {
    it("refuse un fichier vide", () => {
      expect(() => parseCsv("")).toThrow(DomainError);
    });

    it("refuse un fichier de lignes vides", () => {
      expect(() => parseCsv("\n\n\n")).toThrow(DomainError);
    });

    it("prend la première ligne non vide comme en-tête", () => {
      // Un tableur produit volontiers une ligne blanche en tête ; elle ne doit
      // ni faire échouer la lecture ni servir de noms de colonnes.
      const table = parseCsv(";;\nimmeuble;adresse;ville\nTilleuls;12 rue des Lilas;Lyon");

      expect(table.headers).toStrictEqual(["immeuble", "adresse", "ville"]);
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]?.lineNumber).toBe(3);
    });
  });
});
