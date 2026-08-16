import { type SearchQuery, type SearchResponse, searchQuerySchema } from "@asc/contracts";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { JwtPayload } from "../../auth/auth.service.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { SearchService } from "./search.service.js";

/**
 * Recherche globale (spec 010).
 *
 * Le `tenantId` vient du jeton : une recherche ne peut pas atteindre les
 * données d'un autre tenant, même en tapant leur nom exact.
 */
@Controller("search")
export class SearchController {
  constructor(@Inject(SearchService) private readonly search: SearchService) {}

  @Get()
  async query(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ): Promise<SearchResponse> {
    return this.search.search(user.tenantId, query);
  }
}
