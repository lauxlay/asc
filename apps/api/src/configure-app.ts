import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

/**
 * Configuration commune à l'application réelle et à celle des tests.
 *
 * Partager cette fonction est ce qui empêche les tests d'exercer un routage
 * différent de la production — un préfixe oublié d'un côté rendrait toute la
 * suite d'intégration menteuse.
 */

/** Toute l'API vit sous `/api`, ce qui laisse `/` au back-office (ADR-002). */
export const API_PREFIX = "api";

export function configureApi(app: NestFastifyApplication): void {
  app.setGlobalPrefix(API_PREFIX);
}

/** `true` si un back-office buildé est disponible à cet emplacement. */
export function hasWebApp(webDistDir: string | null): webDistDir is string {
  return webDistDir !== null && existsSync(join(webDistDir, "index.html"));
}

/**
 * Sert le back-office depuis le même container que l'API (ADR-002) : un seul
 * point d'entrée, un seul certificat, pas de CORS.
 *
 * Deux morceaux :
 * 1. les fichiers du build, servis par `@fastify/static` (`wildcard: false`
 *    enregistre une route par fichier au lieu d'accaparer `/*`) ;
 * 2. un repli sur `index.html` pour toute autre route — c'est ce qui fait
 *    marcher les liens profonds : `/login` rafraîchi doit servir
 *    l'application, sinon une PWA installée casse au premier redémarrage.
 *
 * Le repli est une route `/*` et non un `setNotFoundHandler` : NestJS
 * enregistre déjà le sien, et Fastify n'en accepte qu'un par instance. Les
 * routes de l'API, plus spécifiques, gardent la priorité.
 */
export function serveWebApp(app: NestFastifyApplication, webDistDir: string): void {
  app.useStaticAssets({ root: webDistDir, wildcard: false });

  // Lu une fois au démarrage : le document ne change pas d'une requête à
  // l'autre.
  const html = readFileSync(join(webDistDir, "index.html"), "utf8");

  app
    .getHttpAdapter()
    .getInstance()
    .get("/*", (request, reply) => {
      if (request.url === `/${API_PREFIX}` || request.url.startsWith(`/${API_PREFIX}/`)) {
        // Une route d'API inconnue reste une erreur d'API : lui rendre du HTML
        // masquerait la faute derrière une page qui a l'air de marcher.
        return reply
          .status(404)
          .send({ statusCode: 404, error: "Not Found", message: "Route inconnue" });
      }
      return (
        reply
          .header("content-type", "text/html; charset=utf-8")
          // Jamais mis en cache : ce document référence les assets versionnés, il
          // doit refléter le déploiement courant (ADR-003).
          .header("cache-control", "no-cache")
          .send(html)
      );
    });
}
