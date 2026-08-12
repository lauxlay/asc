import "reflect-metadata";

import { JwtService } from "@nestjs/jwt";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { AppModule } from "../app.module.js";
import { DEFAULT_TENANT_ID } from "../auth/auth.service.js";
import { hashPassword } from "../auth/password.js";
import { UNIT_REPOSITORY, USER_REPOSITORY } from "../common/tokens.js";
import type { ApiConfig } from "../config/env.js";
import { InMemoryUnitRepository } from "../modules/units/in-memory-unit.repository.js";
import { InMemoryUserRepository } from "../modules/users/in-memory-user.repository.js";

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
    imports: [AppModule.forConfig(TEST_CONFIG)],
  })
    .overrideProvider(UNIT_REPOSITORY)
    .useValue(new InMemoryUnitRepository())
    .overrideProvider(USER_REPOSITORY)
    .useValue(users)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
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
    url: "/auth/login",
    payload: { email: TEST_USER.email, password: TEST_USER.password },
  });
  const body = response.json<{ accessToken: string }>();
  return body.accessToken;
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
