import { type IsoDate, isIsoDate } from "@asc/domain";
import { z } from "zod";

/**
 * Jour calendaire `YYYY-MM-DD`, tel que le domaine le manipule.
 *
 * Le schéma produit directement le type marqué `IsoDate` : une donnée qui
 * franchit la frontière est typée aussi précisément à l'intérieur qu'au
 * moment du parse.
 */
export const isoDateSchema = z.custom<IsoDate>(
  (value) => typeof value === "string" && isIsoDate(value),
  { message: "Date invalide (attendu YYYY-MM-DD)" },
);
