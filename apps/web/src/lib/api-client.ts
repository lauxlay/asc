import {
  type AnalyzeImportResponse,
  analyzeImportResponseSchema,
  type CommitImportResponse,
  type ComplianceDeadlineListResponse,
  type ComplianceQuery,
  type ComplianceResponse,
  type ContactListResponse,
  type ContactResponse,
  type ContractListResponse,
  type ContractResponse,
  type CreateContactRequest,
  type CreateContractRequest,
  type CreateCustomerRequest,
  type CreateSiteRequest,
  type CreateUnitRequest,
  type CustomerListResponse,
  type CustomerResponse,
  commitImportResponseSchema,
  complianceDeadlineListResponseSchema,
  complianceResponseSchema,
  contactListResponseSchema,
  contactResponseSchema,
  contractListResponseSchema,
  contractResponseSchema,
  customerListResponseSchema,
  customerResponseSchema,
  type ImportIssue,
  importIssueSchema,
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
import type { ColumnMapping } from "@asc/domain";
import { type ZodType, z } from "zod";

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
  /**
   * Erreurs ligne à ligne rendues par l'import (spec 004, R4.2).
   *
   * Vide pour toutes les autres routes : seul l'import a besoin de rapporter
   * des centaines de problèmes localisés plutôt qu'un message unique.
   */
  readonly issues: readonly ImportIssue[];

  constructor(status: number, message: string, issues: readonly ImportIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
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
    const { message, issues } = await errorPayload(response);
    throw new ApiError(response.status, message, issues);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(response.status, "Réponse inattendue du serveur");
  }
  return parsed.data;
}

async function errorPayload(
  response: Response,
): Promise<{ message: string; issues: readonly ImportIssue[] }> {
  const fallback = { message: `Erreur ${response.status}`, issues: [] as readonly ImportIssue[] };
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) {
      return fallback;
    }
    const { message, issues } = payload as { message?: unknown; issues?: unknown };
    const parsedIssues = z.array(importIssueSchema).safeParse(issues);

    return {
      message:
        typeof message === "string"
          ? message
          : message === undefined
            ? fallback.message
            : JSON.stringify(message),
      issues: parsedIssues.success ? parsedIssues.data : [],
    };
  } catch {
    // Corps illisible : le code HTTP reste la seule information fiable.
    return fallback;
  }
}

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return request("/auth/login", loginResponseSchema, { method: "POST", body: credentials });
}

/** `query` vide rend tout le parc (spec 002, R2.4). */
export function listSites(token: string, query = ""): Promise<SiteListResponse> {
  const search = query === "" ? "" : `?q=${encodeURIComponent(query)}`;
  return request(`/sites${search}`, siteListResponseSchema, { token });
}

/** Immeubles rattachés à un client (spec 003). */
export function listSitesOfCustomer(token: string, customerId: string): Promise<SiteListResponse> {
  return request(`/sites?customerId=${encodeURIComponent(customerId)}`, siteListResponseSchema, {
    token,
  });
}

/** Rattache l'immeuble à un client, ou l'en détache avec `null`. */
export function setSiteCustomer(
  token: string,
  siteId: string,
  customerId: string | null,
): Promise<SiteResponse> {
  return request(`/sites/${encodeURIComponent(siteId)}`, siteResponseSchema, {
    method: "PATCH",
    body: { customerId },
    token,
  });
}

export function listCustomers(token: string): Promise<CustomerListResponse> {
  return request("/customers", customerListResponseSchema, { token });
}

export function getCustomer(token: string, customerId: string): Promise<CustomerResponse> {
  return request(`/customers/${encodeURIComponent(customerId)}`, customerResponseSchema, { token });
}

export function createCustomer(
  token: string,
  customer: CreateCustomerRequest,
): Promise<CustomerResponse> {
  return request("/customers", customerResponseSchema, {
    method: "POST",
    body: customer,
    token,
  });
}

export function listContactsOfCustomer(
  token: string,
  customerId: string,
): Promise<ContactListResponse> {
  return request(
    `/contacts?customerId=${encodeURIComponent(customerId)}`,
    contactListResponseSchema,
    { token },
  );
}

export function createContact(
  token: string,
  contact: CreateContactRequest,
): Promise<ContactResponse> {
  return request("/contacts", contactResponseSchema, { method: "POST", body: contact, token });
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

export function listContracts(token: string): Promise<ContractListResponse> {
  return request("/contracts", contractListResponseSchema, { token });
}

export function getContract(token: string, contractId: string): Promise<ContractResponse> {
  return request(`/contracts/${encodeURIComponent(contractId)}`, contractResponseSchema, { token });
}

export function createContract(
  token: string,
  contract: CreateContractRequest,
): Promise<ContractResponse> {
  return request("/contracts", contractResponseSchema, {
    method: "POST",
    body: contract,
    token,
  });
}

/** Remplace la liste des appareils couverts par le contrat. */
export function setContractUnits(
  token: string,
  contractId: string,
  unitIds: readonly string[],
): Promise<ContractResponse> {
  return request(`/contracts/${encodeURIComponent(contractId)}`, contractResponseSchema, {
    method: "PATCH",
    body: { unitIds },
    token,
  });
}

/** Échéances calculées à la demande par le moteur du lot L0.2 (spec 005, R4). */
export function listContractDeadlines(
  token: string,
  contractId: string,
): Promise<ComplianceDeadlineListResponse> {
  return request(
    `/contracts/${encodeURIComponent(contractId)}/deadlines`,
    complianceDeadlineListResponseSchema,
    { token },
  );
}

/** Conformité du parc, calculée à chaque appel (spec 006, R7). */
export function getCompliance(
  token: string,
  status: ComplianceQuery["status"],
): Promise<ComplianceResponse> {
  const search = status === undefined ? "" : `?status=${encodeURIComponent(status)}`;
  return request(`/compliance${search}`, complianceResponseSchema, { token });
}

/** Analyse un CSV sans rien écrire. `mapping` à `null` = laisser deviner. */
export function analyzeImport(
  token: string,
  csv: string,
  mapping: ColumnMapping | null,
): Promise<AnalyzeImportResponse> {
  return request("/parc-import/analyze", analyzeImportResponseSchema, {
    method: "POST",
    body: { csv, mapping },
    token,
  });
}

export function commitImport(
  token: string,
  csv: string,
  mapping: ColumnMapping,
): Promise<CommitImportResponse> {
  return request("/parc-import", commitImportResponseSchema, {
    method: "POST",
    body: { csv, mapping },
    token,
  });
}
