import {
  type ContactListQuery,
  type ContactListResponse,
  type ContactResponse,
  type CreateContactRequest,
  contactListQuerySchema,
  createContactRequestSchema,
  type UpdateContactRequest,
  updateContactRequestSchema,
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
import { ContactsService } from "./contacts.service.js";

/**
 * Le `tenantId` vient systématiquement du jeton (`@CurrentUser`), jamais d'un
 * paramètre de requête : un client ne peut pas désigner le tenant qu'il lit.
 */
@Controller("contacts")
export class ContactsController {
  constructor(@Inject(ContactsService) private readonly contacts: ContactsService) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(contactListQuerySchema)) query: ContactListQuery,
  ): Promise<ContactListResponse> {
    const items = await this.contacts.list(user.tenantId, {
      customerId: query.customerId,
      siteId: query.siteId,
    });
    return { items: [...items] };
  }

  @Get(":id")
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ContactResponse> {
    return this.contacts.getById(user.tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createContactRequestSchema)) body: CreateContactRequest,
  ): Promise<ContactResponse> {
    return this.contacts.create(user.tenantId, body);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateContactRequestSchema)) body: UpdateContactRequest,
  ): Promise<ContactResponse> {
    return this.contacts.update(user.tenantId, id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param("id") id: string): Promise<void> {
    await this.contacts.delete(user.tenantId, id);
  }
}
