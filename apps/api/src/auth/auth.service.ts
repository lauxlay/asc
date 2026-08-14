import type { AuthenticatedUser, LoginRequest, LoginResponse } from "@asc/contracts";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { USER_REPOSITORY } from "../common/tokens.js";
import { API_CONFIG, type ApiConfig } from "../config/env.js";
import type { UserRepository } from "../modules/users/user.repository.js";
import { verifyPassword } from "./password.js";

/** Contenu du jeton. `sub` et `tenantId` gouvernent tout accès aux données. */
export interface JwtPayload {
  readonly sub: string;
  readonly tenantId: string;
  readonly email: string;
  readonly role: AuthenticatedUser["role"];
}

/**
 * Mono-tenant en Phase 0 : le tenant est celui de l'utilisateur trouvé, il
 * n'est jamais fourni par le client. Le passage multi-tenant consistera à
 * résoudre le tenant depuis le domaine de connexion, sans toucher au reste.
 */
export const DEFAULT_TENANT_ID = "default";

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginRequest): Promise<LoginResponse> {
    const user = await this.users.findByEmail(DEFAULT_TENANT_ID, email);

    // Sur email inconnu, mot de passe faux **ou compte désactivé** (spec 008,
    // R1.9) : même erreur, même message. Rien ne doit permettre d'énumérer les
    // comptes existants ni de distinguer « désactivé » de « inexistant ».
    const valid =
      user !== null && user.active && (await verifyPassword(password, user.passwordHash));
    if (!valid || user === null) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.JWT_EXPIRES_IN,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
      },
    };
  }
}
