import {
  type CreateUnitRequest,
  createUnitRequestSchema,
  type UnitListQuery,
  type UnitListResponse,
  type UnitResponse,
  type UpdateUnitRequest,
  unitListQuerySchema,
  updateUnitRequestSchema,
} from "@asc/contracts";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type { JwtPayload } from "../../auth/auth.service.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { UnitsService } from "./units.service.js";

/**
 * Le `tenantId` vient systématiquement du jeton (`@CurrentUser`), jamais d'un
 * paramètre de requête : un client ne peut pas désigner le tenant qu'il lit.
 */
@Controller("units")
export class UnitsController {
  constructor(@Inject(UnitsService) private readonly units: UnitsService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(unitListQuerySchema)) query: UnitListQuery,
  ): Promise<UnitListResponse> {
    return { items: [...(await this.units.list(user.tenantId, query.siteId))] };
  }

  @Get(":id")
  async getById(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<UnitResponse> {
    return this.units.getById(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createUnitRequestSchema)) body: CreateUnitRequest,
  ): Promise<UnitResponse> {
    return this.units.create(user.tenantId, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUnitRequestSchema)) body: UpdateUnitRequest,
  ): Promise<UnitResponse> {
    return this.units.update(user.tenantId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<void> {
    await this.units.delete(user.tenantId, id);
  }
}
