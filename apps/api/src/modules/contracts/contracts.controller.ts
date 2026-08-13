import {
  type ComplianceDeadlineListResponse,
  type ContractListQuery,
  type ContractListResponse,
  type ContractResponse,
  type CreateContractRequest,
  contractListQuerySchema,
  createContractRequestSchema,
  type UpdateContractRequest,
  updateContractRequestSchema,
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
import { ContractsService } from "./contracts.service.js";

/**
 * Le `tenantId` vient systématiquement du jeton (`@CurrentUser`), jamais d'un
 * paramètre de requête : un client ne peut pas désigner le tenant qu'il lit.
 */
@Controller("contracts")
export class ContractsController {
  constructor(@Inject(ContractsService) private readonly contracts: ContractsService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(contractListQuerySchema)) query: ContractListQuery,
  ): Promise<ContractListResponse> {
    return { items: [...(await this.contracts.list(user.tenantId, query.unitId))] };
  }

  @Get(":id")
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ContractResponse> {
    return this.contracts.getById(user.tenantId, id);
  }

  /** Échéances calculées à la demande — jamais stockées (spec 005, R4.1). */
  @Get(":id/deadlines")
  async deadlines(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ComplianceDeadlineListResponse> {
    return this.contracts.deadlinesOf(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createContractRequestSchema)) body: CreateContractRequest,
  ): Promise<ContractResponse> {
    return this.contracts.create(user.tenantId, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContractRequestSchema)) body: UpdateContractRequest,
  ): Promise<ContractResponse> {
    return this.contracts.update(user.tenantId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<void> {
    await this.contracts.delete(user.tenantId, id);
  }
}
