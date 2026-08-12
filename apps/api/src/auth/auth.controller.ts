import { type LoginRequest, type LoginResponse, loginRequestSchema } from "@asc/contracts";
import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import { Public } from "./public.decorator.js";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** 200 et non 201 : une connexion ne crée pas de ressource. */
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
  ): Promise<LoginResponse> {
    return this.auth.login(body);
  }
}
