import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { FastifyRequest } from "fastify";
import type { JwtPayload } from "./auth.service.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

/** La requête porte l'utilisateur authentifié une fois la garde passée. */
export interface AuthenticatedRequest extends FastifyRequest {
  user?: JwtPayload;
}

/**
 * Garde d'authentification : jeton Bearer valide exigé.
 *
 * Elle est appliquée globalement ; les routes publiques s'en exemptent
 * explicitement avec `@Public()`. Le défaut est donc « fermé » — oublier une
 * garde n'ouvre pas une route par accident.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (header === undefined || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("Jeton manquant");
    }

    try {
      request.user = await this.jwt.verifyAsync<JwtPayload>(header.slice("Bearer ".length));
    } catch {
      throw new UnauthorizedException("Jeton invalide ou expiré");
    }
    return true;
  }
}
