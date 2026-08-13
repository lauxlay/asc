import {
  type CreateSiteRequest,
  createSiteRequestSchema,
  type SiteListQuery,
  type SiteListResponse,
  type SiteResponse,
  siteListQuerySchema,
  type UpdateSiteRequest,
  updateSiteRequestSchema,
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
import { SitesService } from "./sites.service.js";

/**
 * Le `tenantId` vient systématiquement du jeton (`@CurrentUser`), jamais d'un
 * paramètre de requête : un client ne peut pas désigner le tenant qu'il lit.
 */
@Controller("sites")
export class SitesController {
  constructor(@Inject(SitesService) private readonly sites: SitesService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(siteListQuerySchema)) query: SiteListQuery,
  ): Promise<SiteListResponse> {
    const items = await this.sites.list(user.tenantId, {
      q: query.q,
      customerId: query.customerId,
    });
    return { items: [...items] };
  }

  @Get(":id")
  async getById(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<SiteResponse> {
    return this.sites.getById(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createSiteRequestSchema)) body: CreateSiteRequest,
  ): Promise<SiteResponse> {
    return this.sites.create(user.tenantId, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSiteRequestSchema)) body: UpdateSiteRequest,
  ): Promise<SiteResponse> {
    return this.sites.update(user.tenantId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<void> {
    await this.sites.delete(user.tenantId, id);
  }
}
