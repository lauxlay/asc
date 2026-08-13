import { z } from "zod";

/**
 * Configuration lue dans l'environnement — une frontière comme une autre, donc
 * parsée. Un démarrage avec une configuration incomplète échoue tout de suite,
 * avec un message qui dit quelle variable manque.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  /** Racine du volume persistant monté en production (ADR-002). */
  DATA_DIR: z.string().min(1).default("./data"),
  /**
   * Back-office buildé à servir depuis le même container (ADR-002). Absent en
   * développement, où Vite s'en charge.
   */
  WEB_DIST_DIR: z
    .string()
    .min(1)
    .nullable()
    .default(null)
    .transform((value) => (value === "" ? null : value)),
  /** Secret de signature des jetons — aucune valeur par défaut, jamais. */
  JWT_SECRET: z.string().min(32, "JWT_SECRET doit faire au moins 32 caractères"),
  /** Durée de validité d'un jeton, en secondes. */
  JWT_EXPIRES_IN: z.coerce
    .number()
    .int()
    .positive()
    .default(8 * 60 * 60),
});

export type ApiConfig = z.infer<typeof envSchema>;

/** Jeton d'injection : les services dépendent de la config, pas de `process.env`. */
export const API_CONFIG = Symbol("API_CONFIG");

export function loadConfig(source: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n  ");
    throw new Error(`Configuration invalide :\n  ${details}`);
  }
  return parsed.data;
}
