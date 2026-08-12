import {
  type LoginRequest,
  type LoginResponse,
  loginResponseSchema,
  type UnitListResponse,
  unitListResponseSchema,
} from "@asc/contracts";
import type { ZodType } from "zod";

/**
 * Client HTTP du back-office.
 *
 * Même origine, préfixe `/api` : en développement c'est le proxy Vite qui
 * redirige, en production le reverse proxy (ADR-002). Aucune URL absolue dans
 * le code applicatif, donc rien à reconfigurer selon l'environnement.
 *
 * Les réponses sont parsées avec les schémas de `@asc/contracts` : une API qui
 * dérive est détectée ici, pas trois écrans plus loin.
 */

const BASE_URL = "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly token?: string | null;
}

async function request<T>(
  path: string,
  schema: ZodType<T>,
  { method = "GET", body, token }: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token == null ? {} : { authorization: `Bearer ${token}` }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    // `fetch` ne rejette que sur une panne réseau : pas de code HTTP à donner.
    throw new ApiError(0, "Serveur injoignable");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(response.status, "Réponse inattendue du serveur");
  }
  return parsed.data;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "message" in payload) {
      const { message } = payload as { message: unknown };
      return typeof message === "string" ? message : JSON.stringify(message);
    }
  } catch {
    // Corps illisible : le code HTTP reste la seule information fiable.
  }
  return `Erreur ${response.status}`;
}

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return request("/auth/login", loginResponseSchema, { method: "POST", body: credentials });
}

export function listUnits(token: string): Promise<UnitListResponse> {
  return request("/units", unitListResponseSchema, { token });
}
