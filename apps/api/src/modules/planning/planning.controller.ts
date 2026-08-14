import { type PlanningQuery, type PlanningResponse, planningQuerySchema } from "@asc/contracts";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { JwtPayload } from "../../auth/auth.service.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { PlanningService } from "./planning.service.js";

/** Une requête = un écran de planning : la semaine, ses lignes et le backlog. */
@Controller("planning")
export class PlanningController {
  constructor(@Inject(PlanningService) private readonly planning: PlanningService) {}

  @Get()
  async week(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(planningQuerySchema)) query: PlanningQuery,
  ): Promise<PlanningResponse> {
    return this.planning.week(user.tenantId, query);
  }
}
