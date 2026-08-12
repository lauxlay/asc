import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "asc:isPublic";

/**
 * Exempte une route de la garde d'authentification.
 *
 * La garde étant globale, le défaut est « fermé » : une route n'est ouverte que
 * si quelqu'un l'a explicitement décidé, jamais par oubli.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
