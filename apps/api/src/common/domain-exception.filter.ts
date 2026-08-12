import { DomainError } from "@asc/domain";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { StorageError } from "../storage/storage-error.js";

/**
 * Traduit les erreurs des couches basses en réponses HTTP.
 *
 * - `DomainError` : une règle métier a été violée → 422, le message est utile
 *   au client.
 * - `StorageError` : l'infrastructure est en défaut → 500, et le détail reste
 *   dans les logs. Un chemin de fichier ou un message de parse n'a rien à faire
 *   dans une réponse HTTP.
 */
@Catch(DomainError, StorageError)
export class DomainExceptionFilter implements ExceptionFilter {
  readonly #logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError | StorageError, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof DomainError) {
      void reply.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: "Unprocessable Entity",
        message: exception.message,
      });
      return;
    }

    this.#logger.error(exception.message, exception.stack);
    void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: "Erreur de stockage",
    });
  }
}
