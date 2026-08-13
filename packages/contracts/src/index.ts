/**
 * @asc/contracts — schémas Zod des API, partagés client/serveur.
 *
 * Point de synchronisation entre agents : seul l'agent back les modifie, front
 * et mobile les consomment (`docs/03-application/08-organisation-multi-agents.md`).
 */
export {
  type AuthenticatedUser,
  authenticatedUserSchema,
  type LoginRequest,
  type LoginResponse,
  loginRequestSchema,
  loginResponseSchema,
  userRoleSchema,
} from "./auth.contract.js";
export {
  type ContactListQuery,
  type ContactListResponse,
  type ContactResponse,
  type CreateContactRequest,
  contactListQuerySchema,
  contactListResponseSchema,
  contactResponseSchema,
  createContactRequestSchema,
  type UpdateContactRequest,
  updateContactRequestSchema,
} from "./contact.contract.js";
export {
  type CreateCustomerRequest,
  type CustomerListResponse,
  type CustomerResponse,
  createCustomerRequestSchema,
  customerListResponseSchema,
  customerResponseSchema,
  customerTypeSchema,
  type UpdateCustomerRequest,
  updateCustomerRequestSchema,
} from "./customer.contract.js";
export { isoDateSchema } from "./iso-date.schema.js";
export {
  type CreateSiteRequest,
  createSiteRequestSchema,
  type SiteListQuery,
  type SiteListResponse,
  type SiteResponse,
  siteListQuerySchema,
  siteListResponseSchema,
  siteResponseSchema,
  type UpdateSiteRequest,
  updateSiteRequestSchema,
} from "./site.contract.js";
export {
  type CreateUnitRequest,
  createUnitRequestSchema,
  type UnitListQuery,
  type UnitListResponse,
  type UnitResponse,
  type UpdateUnitRequest,
  unitListQuerySchema,
  unitListResponseSchema,
  unitResponseSchema,
  updateUnitRequestSchema,
} from "./unit.contract.js";
