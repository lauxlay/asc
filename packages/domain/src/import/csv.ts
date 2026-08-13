import { DomainError } from "../errors.js";

/**
 * Lecture d'un CSV réel (spec 004, R1).
 *
 * Écrit à la main plutôt qu'emprunté : la logique doit rester pure et sans
 * dépendance dans `domain` (règle des dépendances de `07-phase0-fondations.md`),
 * et le besoin tient en quelques règles — celles de la RFC 4180, plus les
 * habitudes d'Excel francophone (séparateur `;`, BOM, CRLF).
 */

/** Séparateurs candidats, dans l'ordre de préférence en cas d'égalité. */
const SEPARATORS = [";", ","] as const;

export type CsvSeparator = (typeof SEPARATORS)[number];

export interface CsvTable {
  readonly separator: CsvSeparator;
  /** Noms des colonnes, dans l'ordre du fichier. */
  readonly headers: readonly string[];
  /** Lignes de données. `lineNumber` est le numéro dans le fichier (en-tête = 1). */
  readonly rows: readonly CsvRow[];
}

export interface CsvRow {
  readonly lineNumber: number;
  /** Cellules alignées sur `headers` ; une ligne courte est complétée par `""`. */
  readonly cells: readonly string[];
}

const BOM = "﻿";

/**
 * Découpe un texte CSV en lignes de champs, en respectant les guillemets.
 *
 * Un champ entre guillemets peut contenir le séparateur, un retour à la ligne
 * et des guillemets doublés. C'est précisément pourquoi on ne peut pas se
 * contenter de `split("\n")` : `"12, rue des Lilas"` est **une** cellule.
 */
function splitRecords(text: string, separator: string): string[][] {
  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;

  const endField = (): void => {
    fields.push(field);
    field = "";
  };
  const endRecord = (): void => {
    endField();
    records.push(fields);
    fields = [];
  };

  while (index < text.length) {
    const char = text[index] ?? "";

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          // Guillemet doublé : un guillemet littéral, on saute le second.
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"' && field === "") {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === separator) {
      endField();
      index += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      endRecord();
      // CRLF compte pour une seule fin de ligne.
      index += char === "\r" && text[index + 1] === "\n" ? 2 : 1;
      continue;
    }

    field += char;
    index += 1;
  }

  // Dernière ligne sans fin de ligne finale.
  if (field !== "" || fields.length > 0) {
    endRecord();
  }
  return records;
}

/** `true` si la ligne ne porte aucune donnée (spec 004, R1.5). */
function isBlank(fields: readonly string[]): boolean {
  return fields.every((value) => value.trim() === "");
}

/**
 * Séparateur qui découpe le plus de colonnes sur la ligne d'en-tête
 * (spec 004, R1.1).
 */
function detectSeparator(text: string): CsvSeparator {
  let best: CsvSeparator = SEPARATORS[0];
  let bestCount = 0;

  for (const candidate of SEPARATORS) {
    const [header] = splitRecords(text, candidate);
    const count = header?.length ?? 0;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Lit un texte CSV. Lève `DomainError` si aucun en-tête exploitable n'est
 * trouvé (spec 004, R1.6).
 */
export function parseCsv(text: string): CsvTable {
  const withoutBom = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const separator = detectSeparator(withoutBom);
  const records = splitRecords(withoutBom, separator);

  // Le numéro de ligne suit le fichier, pas la position après filtrage : c'est
  // celui-là que l'utilisateur voit dans son tableur.
  const numbered = records.map((fields, position) => ({ fields, lineNumber: position + 1 }));
  const meaningful = numbered.filter((record) => !isBlank(record.fields));

  // La première ligne non vide fait l'en-tête : un fichier qui commence par une
  // ligne blanche — Excel en produit — reste exploitable.
  const header = meaningful[0];
  if (header === undefined) {
    throw new DomainError("Le fichier est vide");
  }

  const headers = header.fields.map((value) => value.trim());
  const rows = meaningful.slice(1).map(({ fields, lineNumber }) => ({
    lineNumber,
    // Une ligne plus courte que l'en-tête est complétée : un tableur laisse
    // volontiers tomber les cellules vides de fin.
    cells: headers.map((_header, column) => (fields[column] ?? "").trim()),
  }));

  return { separator, headers, rows };
}
