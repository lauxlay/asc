import {
  type CreateSiteRequest,
  type CreateUnitRequest,
  type LoginRequest,
  type LoginResponse,
  loginResponseSchema,
  type SiteListResponse,
  type SiteResponse,
  siteListResponseSchema,
  siteResponseSchema,
  type UnitListResponse,
  type UnitResponse,
  unitListResponseSchema,
  unitResponseSchema,
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

/** `query` vide rend tout le parc (spec 002, R2.4). */
export function listSites(token: string, query = ""): Promise<SiteListResponse> {
  const search = query === "" ? "" : `?q=${encodeURIComponent(query)}`;
  return request(`/sites${search}`, siteListResponseSchema, { token });
}

export function getSite(token: string, siteId: string): Promise<SiteResponse> {
  return request(`/sites/${encodeURIComponent(siteId)}`, siteResponseSchema, { token });
}

export function createSite(token: string, site: CreateSiteRequest): Promise<SiteResponse> {
  return request("/sites", siteResponseSchema, { method: "POST", body: site, token });
}

/** `siteId` restreint la liste aux appareils d'un immeuble. */
export function listUnits(token: string, siteId?: string): Promise<UnitListResponse> {
  const search = siteId === undefined ? "" : `?siteId=${encodeURIComponent(siteId)}`;
  return request(`/units${search}`, unitListResponseSchema, { token });
}

export function createUnit(token: string, unit: CreateUnitRequest): Promise<UnitResponse> {
  return request("/units", unitResponseSchema, { method: "POST", body: unit, token });
}
