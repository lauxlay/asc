import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Hachage de mots de passe avec **scrypt**, fourni par Node.
 *
 * scrypt est une fonction de dérivation lente et gourmande en mémoire, conçue
 * pour résister au cassage par force brute. Elle est dans la bibliothèque
 * standard : pas de dépendance native à compiler dans l'image Docker.
 *
 * Format stocké : `scrypt$N$r$p$sel$empreinte`, en base64url. Les paramètres
 * voyagent avec l'empreinte pour qu'on puisse les durcir plus tard sans
 * invalider les mots de passe existants.
 */

interface ScryptParameters {
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptParameters & { maxmem: number },
) => Promise<Buffer>;

const PARAMETERS: ScryptParameters = { N: 2 ** 15, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * scrypt a besoin d'environ `128 · N · r` octets. Node plafonne par défaut à
 * 32 Mio, ce que nos paramètres dépassent : on relève la limite au double du
 * besoin réel plutôt que de choisir des paramètres plus faibles.
 */
function maxmemFor({ N, r }: ScryptParameters): number {
  return 2 * 128 * N * r;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES, {
    ...PARAMETERS,
    maxmem: maxmemFor(PARAMETERS),
  });
  return [
    "scrypt",
    PARAMETERS.N,
    PARAMETERS.r,
    PARAMETERS.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/**
 * Vérifie un mot de passe. Rend `false` sur une empreinte illisible plutôt que
 * de lever : un enregistrement corrompu ne doit pas devenir un canal
 * d'information ni un déni de service sur la route de login.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  const options: ScryptParameters = { N: Number(rawN), r: Number(rawR), p: Number(rawP) };
  if (!Object.values(options).every((value) => Number.isInteger(value) && value > 0)) {
    return false;
  }

  const expected = Buffer.from(rawKey, "base64url");
  if (expected.length === 0) {
    return false;
  }

  try {
    const actual = await scryptAsync(password, Buffer.from(rawSalt, "base64url"), expected.length, {
      ...options,
      maxmem: maxmemFor(options),
    });
    // Comparaison à temps constant : la durée ne doit pas révéler
    // combien d'octets sont corrects.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
