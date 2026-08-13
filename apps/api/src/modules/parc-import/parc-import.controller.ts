import {
  type AnalyzeImportRequest,
  type AnalyzeImportResponse,
  analyzeImportRequestSchema,
  type CommitImportRequest,
  type CommitImportResponse,
  commitImportRequestSchema,
} from "@asc/contracts";
import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import type { JwtPayload } from "../../auth/auth.service.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { ParcImportService } from "./parc-import.service.js";

/**
 * Import du parc en deux temps : analyser, puis confirmer (spec 004).
 *
 * L'analyse est un `POST` bien qu'elle ne modifie rien : elle transporte le
 * fichier dans le corps de la requête, ce qu'un `GET` ne permet pas.
 *
 * Le `tenantId` vient systématiquement du jeton (`@CurrentUser`), jamais du
 * corps : un client ne peut pas importer dans le parc d'un autre.
 */
@Controller("parc-import")
export class ParcImportController {
  constructor(@Inject(ParcImportService) private readonly parcImport: ParcImportService) {}

  @Post("analyze")
  @HttpCode(HttpStatus.OK)
  async analyze(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(analyzeImportRequestSchema)) body: AnalyzeImportRequest,
  ): Promise<AnalyzeImportResponse> {
    return this.parcImport.analyze(user.tenantId, body.csv, body.mapping);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async commit(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(commitImportRequestSchema)) body: CommitImportRequest,
  ): Promise<CommitImportResponse> {
    return this.parcImport.commit(user.tenantId, body.csv, body.mapping);
  }
}
