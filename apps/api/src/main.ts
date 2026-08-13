import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { createAppModule } from "./app.module.js";
import { loadConfig } from "./config/env.js";
import { configureApi, hasWebApp, serveWebApp } from "./configure-app.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  const app = await NestFactory.create<NestFastifyApplication>(
    createAppModule(config),
    new FastifyAdapter(),
  );

  configureApi(app);

  const webDistDir = config.WEB_DIST_DIR;
  const servingWeb = hasWebApp(webDistDir);
  if (servingWeb) {
    serveWebApp(app, webDistDir);
  }

  // Écoute sur toutes les interfaces : dans un container, 127.0.0.1 rendrait
  // l'API injoignable depuis l'extérieur (ADR-002).
  await app.listen({ port: config.PORT, host: "0.0.0.0" });

  Logger.log(
    `API à l'écoute sur le port ${config.PORT}${servingWeb ? " (back-office servi sur /)" : ""}`,
    "Bootstrap",
  );
}

await bootstrap();
