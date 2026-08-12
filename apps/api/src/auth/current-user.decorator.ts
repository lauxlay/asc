import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { JwtPayload } from "./auth.service.js";
import type { AuthenticatedRequest } from "./jwt-auth.guard.js";

/**
 * Injecte l'utilisateur authentifié dans un handler.
 *
 * C'est la seule source du `tenantId` utilisé par les services : il vient du
 * jeton signé, jamais d'un paramètre de requête que le client pourrait choisir.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user === undefined) {
      // Impossible si la garde est passée : le signaler plutôt que de
      // fabriquer un tenant vide.
      throw new Error("CurrentUser utilisé sur une route non protégée");
    }
    return request.user;
  },
);
