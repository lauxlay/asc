import {
  type CreateUserRequest,
  createUserRequestSchema,
  type UpdateUserRequest,
  type UserListResponse,
  type UserResponse,
  updateUserRequestSchema,
} from "@asc/contracts";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { JwtPayload } from "../../auth/auth.service.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { UsersService } from "./users.service.js";

/**
 * Gestion des utilisateurs (spec 008, R1).
 *
 * Pas de `DELETE` : un utilisateur est référencé par des OT passés, et un
 * planning d'il y a trois mois doit rester lisible. On désactive.
 */
@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload): Promise<UserListResponse> {
    return { items: [...(await this.users.list(user.tenantId))] };
  }

  @Get(":id")
  async getById(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<UserResponse> {
    return this.users.getById(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createUserRequestSchema)) body: CreateUserRequest,
  ): Promise<UserResponse> {
    return this.users.create(user.tenantId, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserRequestSchema)) body: UpdateUserRequest,
  ): Promise<UserResponse> {
    // `user.sub` porte la règle « on ne se désactive pas soi-même » (R1.8).
    return this.users.update(user.tenantId, id, body, user.sub);
  }
}
