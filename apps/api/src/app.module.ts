import { type DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { JwtAuthGuard } from "./auth/jwt-auth.guard.js";
import { DomainExceptionFilter } from "./common/domain-exception.filter.js";
import {
  CONTACT_REPOSITORY,
  CUSTOMER_REPOSITORY,
  SITE_REPOSITORY,
  UNIT_REPOSITORY,
  USER_REPOSITORY,
} from "./common/tokens.js";
import { API_CONFIG, type ApiConfig } from "./config/env.js";
import { HealthController } from "./health/health.controller.js";
import { ContactsController } from "./modules/contacts/contacts.controller.js";
import { ContactsService } from "./modules/contacts/contacts.service.js";
import { JsonContactRepository } from "./modules/contacts/json-contact.repository.js";
import { CustomersController } from "./modules/customers/customers.controller.js";
import { CustomersService } from "./modules/customers/customers.service.js";
import { JsonCustomerRepository } from "./modules/customers/json-customer.repository.js";
import { JsonSiteRepository } from "./modules/sites/json-site.repository.js";
import { SitesController } from "./modules/sites/sites.controller.js";
import { SitesService } from "./modules/sites/sites.service.js";
import { JsonUnitRepository } from "./modules/units/json-unit.repository.js";
import { UnitsController } from "./modules/units/units.controller.js";
import { UnitsService } from "./modules/units/units.service.js";
import { JsonUserRepository } from "./modules/users/json-user.repository.js";
import { JsonCollectionStore } from "./storage/json-collection-store.js";

/**
 * Câblage de l'application.
 *
 * C'est le seul endroit qui sait que le stockage est en JSON : les services ne
 * connaissent que les jetons de port. Le jour de la migration SQLite, seules
 * les trois lignes de `useFactory` changent (ADR-001).
 */
@Module({})
export class AppModule {}

/** Construit le module racine à partir d'une configuration validée. */
export function createAppModule(config: ApiConfig): DynamicModule {
  return {
    module: AppModule,
    imports: [
      JwtModule.register({
        secret: config.JWT_SECRET,
        signOptions: { expiresIn: config.JWT_EXPIRES_IN },
      }),
    ],
    controllers: [
      AuthController,
      ContactsController,
      CustomersController,
      HealthController,
      SitesController,
      UnitsController,
    ],
    providers: [
      { provide: API_CONFIG, useValue: config },
      {
        provide: JsonCollectionStore,
        useFactory: () => new JsonCollectionStore(config.DATA_DIR),
      },
      {
        provide: CONTACT_REPOSITORY,
        useFactory: (store: JsonCollectionStore) => new JsonContactRepository(store),
        inject: [JsonCollectionStore],
      },
      {
        provide: CUSTOMER_REPOSITORY,
        useFactory: (store: JsonCollectionStore) => new JsonCustomerRepository(store),
        inject: [JsonCollectionStore],
      },
      {
        provide: SITE_REPOSITORY,
        useFactory: (store: JsonCollectionStore) => new JsonSiteRepository(store),
        inject: [JsonCollectionStore],
      },
      {
        provide: UNIT_REPOSITORY,
        useFactory: (store: JsonCollectionStore) => new JsonUnitRepository(store),
        inject: [JsonCollectionStore],
      },
      {
        provide: USER_REPOSITORY,
        useFactory: (store: JsonCollectionStore) => new JsonUserRepository(store),
        inject: [JsonCollectionStore],
      },
      AuthService,
      ContactsService,
      CustomersService,
      SitesService,
      UnitsService,
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_FILTER, useClass: DomainExceptionFilter },
    ],
  };
}
