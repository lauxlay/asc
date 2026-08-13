import { CUSTOMER_TYPES, type Customer } from "@asc/domain";
import { z } from "zod";

/**
 * Contrats de l'API `customers` (clients : syndics, copropriétés, particuliers).
 *
 * Ni `id` ni `tenantId` ne sont acceptés en entrée : l'identifiant est généré
 * par le serveur (UUID applicatif, ADR-001) et le tenant vient du jeton, jamais
 * du client.
 */

export const customerTypeSchema = z.enum(CUSTOMER_TYPES);

export const customerResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  type: customerTypeSchema,
}) satisfies z.ZodType<Customer>;

export const createCustomerRequestSchema = z.object({
  name: z.string().trim().min(1),
  type: customerTypeSchema,
});

/** `PATCH` : seuls les champs fournis sont modifiés. */
export const updateCustomerRequestSchema = createCustomerRequestSchema.partial();

export const customerListResponseSchema = z.object({
  items: z.array(customerResponseSchema),
});

export type CustomerResponse = z.infer<typeof customerResponseSchema>;
export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;
export type UpdateCustomerRequest = z.infer<typeof updateCustomerRequestSchema>;
export type CustomerListResponse = z.infer<typeof customerListResponseSchema>;
