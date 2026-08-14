import "reflect-metadata";

import { JwtService } from "@nestjs/jwt";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { createAppModule } from "../app.module.js";
import { DEFAULT_TENANT_ID } from "../auth/auth.service.js";
import { hashPassword } from "../auth/password.js";
import {
  CONTACT_REPOSITORY,
  CONTRACT_REPOSITORY,
  CUSTOMER_REPOSITORY,
  SITE_REPOSITORY,
  UNIT_REPOSITORY,
  USER_REPOSITORY,
  WORK_ORDER_REPOSITORY,
} from "../common/tokens.js";
import type { ApiConfig } from "../config/env.js";
import { configureApi } from "../configure-app.js";
import { InMemoryContactRepository } from "../modules/contacts/in-memory-contact.repository.js";
import { InMemoryContractRepository } from "../modules/contracts/in-memory-contract.repository.js";
import { InMemoryCustomerRepository } from "../modules/customers/in-memory-customer.repository.js";
import { InMemorySiteRepository } from "../modules/sites/in-memory-site.repository.js";
import { InMemoryUnitRepository } from "../modules/units/in-memory-unit.repository.js";
import { InMemoryUserRepository } from "../modules/users/in-memory-user.repository.js";
import { InMemoryWorkOrderRepository } from "../modules/work-orders/in-memory-work-order.repository.js";

/**
 * Application de test : le vrai câblage NestJS, avec les adaptateurs mémoire à
 * la place des adaptateurs JSON.
 *
 * C'est précisément ce que permet le pattern repository de l'ADR-001 — les
 * tests d'intégration exercent contrôleurs, pipes, gardes et filtres sans
 * jamais toucher au disque.
 */

export const TEST_CONFIG: ApiConfig = {
  PORT: 0,
  DATA_DIR: "/inexistant-en-test",
  WEB_DIST_DIR: null,
  JWT_SECRET: "secret-de-test-suffisamment-long-pour-zod",
  JWT_EXPIRES_IN: 3600,
};

export const TEST_USER = {
  id: "user-demo",
  email: "dispatcher@ascenseur.test",
  password: "mot-de-passe-de-demo",
  role: "dispatcher",
} as const;

/** scrypt est lent par construction : on ne hache qu'une fois pour toute la suite. */
let passwordHashPromise: Promise<string> | undefined;
function testPasswordHash(): Promise<string> {
  passwordHashPromise ??= hashPassword(TEST_USER.password);
  return passwordHashPromise;
}

export interface TestApp {
  readonly app: NestFastifyApplication;
  readonly jwt: JwtService;
  /** Envoie une requête HTTP à l'application, sans ouvrir de port. */
  readonly inject: NestFastifyApplication["inject"];
  readonly close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const users = new InMemoryUserRepository();
  await users.save({
    id: TEST_USER.id,
    tenantId: DEFAULT_TENANT_ID,
    email: TEST_USER.email,
    role: TEST_USER.role,
    passwordHash: await testPasswordHash(),
  });

  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(TEST_CONFIG)],
  })
    .overrideProvider(CONTACT_REPOSITORY)
    .useValue(new InMemoryContactRepository())
    .overrideProvider(CONTRACT_REPOSITORY)
    .useValue(new InMemoryContractRepository())
    .overrideProvider(CUSTOMER_REPOSITORY)
    .useValue(new InMemoryCustomerRepository())
    .overrideProvider(SITE_REPOSITORY)
    .useValue(new InMemorySiteRepository())
    .overrideProvider(UNIT_REPOSITORY)
    .useValue(new InMemoryUnitRepository())
    .overrideProvider(USER_REPOSITORY)
    .useValue(users)
    .overrideProvider(WORK_ORDER_REPOSITORY)
    .useValue(new InMemoryWorkOrderRepository())
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  // Même configuration qu'en production : sans cela les tests exerceraient un
  // routage différent de celui qui tourne réellement.
  configureApi(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    jwt: app.get(JwtService),
    inject: app.inject.bind(app),
    close: () => app.close(),
  };
}

/** Jeton obtenu par le vrai parcours de connexion. */
export async function login(testApp: TestApp): Promise<string> {
  const response = await testApp.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: TEST_USER.email, password: TEST_USER.password },
  });
  const body = response.json<{ accessToken: string }>();
  return body.accessToken;
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** Adresse de test par défaut ; chaque champ reste surchargeable. */
export const TEST_SITE = {
  name: "Résidence Les Tilleuls",
  addressLine: "12 rue des Lilas",
  postalCode: "69003",
  city: "Lyon",
} as const;

/**
 * Crée un site par le vrai parcours HTTP et rend son identifiant.
 *
 * Un appareil exige désormais un site existant (spec 002, R1) : la plupart des
 * suites commencent donc par là.
 */
export async function createSite(
  testApp: TestApp,
  token: string,
  overrides: Partial<Record<keyof typeof TEST_SITE, string>> & { customerId?: string } = {},
): Promise<string> {
  const response = await testApp.inject({
    method: "POST",
    url: "/api/sites",
    headers: bearer(token),
    payload: { ...TEST_SITE, ...overrides },
  });
  return response.json<{ id: string }>().id;
}

/**
 * Crée un appareil par le vrai parcours HTTP et rend son identifiant.
 *
 * Un contrat ne peut couvrir que des appareils existants (spec 005, R3.1).
 */
export async function createUnit(
  testApp: TestApp,
  token: string,
  siteId: string,
  reference: string,
): Promise<string> {
  const response = await testApp.inject({
    method: "POST",
    url: "/api/units",
    headers: bearer(token),
    payload: { siteId, reference },
  });
  return response.json<{ id: string }>().id;
}

/** Client de test par défaut ; chaque champ reste surchargeable. */
export const TEST_CUSTOMER = {
  name: "Cabinet Dupont",
  type: "managing_agent",
} as const;

/** Crée un client par le vrai parcours HTTP et rend son identifiant. */
export async function createCustomer(
  testApp: TestApp,
  token: string,
  overrides: Partial<Record<keyof typeof TEST_CUSTOMER, string>> = {},
): Promise<string> {
  const response = await testApp.inject({
    method: "POST",
    url: "/api/customers",
    headers: bearer(token),
    payload: { ...TEST_CUSTOMER, ...overrides },
  });
  return response.json<{ id: string }>().id;
}
