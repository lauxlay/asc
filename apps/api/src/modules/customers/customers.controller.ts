import {
  type CreateCustomerRequest,
  type CustomerListResponse,
  type CustomerResponse,
  createCustomerRequestSchema,
  type UpdateCustomerRequest,
  updateCustomerRequestSchema,
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
} from "@nestjs/common";
import type { JwtPayload } from "../../auth/auth.service.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { CustomersService } from "./customers.service.js";

/**
 * Le `tenantId` vient systématiquement du jeton (`@CurrentUser`), jamais d'un
 * paramètre de requête : un client ne peut pas désigner le tenant qu'il lit.
 */
@Controller("customers")
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload): Promise<CustomerListResponse> {
    return { items: [...(await this.customers.list(user.tenantId))] };
  }

  @Get(":id")
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<CustomerResponse> {
    return this.customers.getById(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createCustomerRequestSchema)) body: CreateCustomerRequest,
  ): Promise<CustomerResponse> {
    return this.customers.create(user.tenantId, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCustomerRequestSchema)) body: UpdateCustomerRequest,
  ): Promise<CustomerResponse> {
    return this.customers.update(user.tenantId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<void> {
    await this.customers.delete(user.tenantId, id);
  }
}
