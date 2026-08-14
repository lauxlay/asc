import {
  type CreateWorkOrderRequest,
  createWorkOrderRequestSchema,
  type UpdateWorkOrderRequest,
  updateWorkOrderRequestSchema,
  type WorkOrderChainResponse,
  type WorkOrderListQuery,
  type WorkOrderListResponse,
  type WorkOrderResponse,
  workOrderListQuerySchema,
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
import { WorkOrdersService } from "./work-orders.service.js";

/**
 * Le `tenantId` vient systématiquement du jeton (`@CurrentUser`), jamais d'un
 * paramètre de requête : un client ne peut pas désigner le tenant qu'il lit.
 */
@Controller("work-orders")
export class WorkOrdersController {
  constructor(@Inject(WorkOrdersService) private readonly workOrders: WorkOrdersService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(workOrderListQuerySchema)) query: WorkOrderListQuery,
  ): Promise<WorkOrderListResponse> {
    return { items: [...(await this.workOrders.list(user.tenantId, query))] };
  }

  @Get(":id")
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<WorkOrderResponse> {
    return this.workOrders.getById(user.tenantId, id);
  }

  /** Chaîne de l'OT dans les deux sens (spec 007, R5.5). */
  @Get(":id/chain")
  async chain(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<WorkOrderChainResponse> {
    return this.workOrders.chainOf(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createWorkOrderRequestSchema)) body: CreateWorkOrderRequest,
  ): Promise<WorkOrderResponse> {
    return this.workOrders.create(user.tenantId, body);
  }

  /**
   * Rattache un signalement supplémentaire — sans créer d'OT (spec 007, R2.3).
   *
   * `POST` sur une sous-ressource plutôt que `PATCH` d'un compteur : le client
   * ne fixe pas la valeur, il déclare un événement.
   */
  @Post(":id/reports")
  @HttpCode(HttpStatus.OK)
  async attachReport(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<WorkOrderResponse> {
    return this.workOrders.attachReport(user.tenantId, id);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateWorkOrderRequestSchema)) body: UpdateWorkOrderRequest,
  ): Promise<WorkOrderResponse> {
    return this.workOrders.update(user.tenantId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<void> {
    await this.workOrders.delete(user.tenantId, id);
  }
}
