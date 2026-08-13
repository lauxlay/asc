import {
  type ComplianceQuery,
  type ComplianceResponse,
  complianceQuerySchema,
} from "@asc/contracts";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { JwtPayload } from "../../auth/auth.service.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { ComplianceService } from "./compliance.service.js";

/**
 * Conformité du parc — lecture seule, calculée à chaque appel (spec 006, R7).
 *
 * Le `tenantId` vient systématiquement du jeton (`@CurrentUser`), jamais d'un
 * paramètre de requête.
 */
@Controller("compliance")
export class ComplianceController {
  constructor(@Inject(ComplianceService) private readonly compliance: ComplianceService) {}

  @Get()
  async overview(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(complianceQuerySchema)) query: ComplianceQuery,
  ): Promise<ComplianceResponse> {
    return this.compliance.overview(user.tenantId, query);
  }
}
