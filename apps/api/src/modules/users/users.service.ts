import { randomUUID } from "node:crypto";
import type { CreateUserRequest, UpdateUserRequest } from "@asc/contracts";
import type { Id, User } from "@asc/domain";
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { hashPassword } from "../../auth/password.js";
import { USER_REPOSITORY } from "../../common/tokens.js";
import type { PersistedUser, UserRepository } from "./user.repository.js";

/**
 * Gestion minimale des utilisateurs (spec 008, R1) : lister, créer, désactiver.
 *
 * Aucune méthode ne rend `passwordHash` : le service traduit systématiquement
 * l'enregistrement stocké en entité de domaine, qui ne porte pas le secret.
 * C'est la seule barrière nécessaire pour que le hachage ne fuie jamais dans
 * une réponse.
 *
 * **Pas de contrôle de rôle** : il n'en existe nulle part dans le produit et
 * aucun lot ne le porte (registre des décisions métier, A2). En ajouter un ici
 * seulement donnerait l'illusion d'un contrôle d'accès.
 */
@Injectable()
export class UsersService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  /** Actifs et désactivés : un compte fermé doit rester visible pour être rouvert. */
  async list(tenantId: Id): Promise<readonly User[]> {
    return (await this.users.findAll(tenantId)).map(toUser);
  }

  async getById(tenantId: Id, id: Id): Promise<User> {
    return toUser(await this.#require(tenantId, id));
  }

  /**
   * Crée un utilisateur actif.
   *
   * Le mot de passe initial est choisi par l'administrateur et transmis hors de
   * l'outil (R1.4) : la Phase 0 n'a pas de service d'e-mail, donc ni invitation
   * ni lien de réinitialisation.
   */
  async create(tenantId: Id, input: CreateUserRequest): Promise<User> {
    const user: PersistedUser = {
      id: randomUUID(),
      tenantId,
      email: input.email,
      name: input.name,
      role: input.role,
      active: true,
      passwordHash: await hashPassword(input.password),
    };

    // L'unicité de l'email est tranchée par l'adaptateur, pas ici (R1.7) : un
    // « je vérifie puis j'écris » depuis le service laisserait deux créations
    // simultanées passer toutes les deux.
    const created = await this.users.createIfEmailFree(user);
    if (created === null) {
      throw new ConflictException(`L'email ${input.email} est déjà utilisé`);
    }
    return toUser(created);
  }

  /**
   * Désactive, réactive, corrige un nom.
   *
   * `currentUserId` sert à une seule règle : **on ne peut pas se désactiver
   * soi-même** (R1.8). C'est la seule façon de se verrouiller dehors sans
   * recours en Phase 0, où personne ne peut rouvrir un compte de l'extérieur.
   */
  async update(tenantId: Id, id: Id, changes: UpdateUserRequest, currentUserId: Id): Promise<User> {
    const current = await this.#require(tenantId, id);

    if (changes.active === false && id === currentUserId) {
      throw new UnprocessableEntityException(
        "Vous ne pouvez pas désactiver votre propre compte : personne ne pourrait le rouvrir",
      );
    }

    const updated: PersistedUser = {
      ...current,
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.active === undefined ? {} : { active: changes.active }),
    };
    await this.users.save(updated);
    return toUser(updated);
  }

  async #require(tenantId: Id, id: Id): Promise<PersistedUser> {
    const user = await this.users.findById(tenantId, id);
    if (user === null) {
      throw new NotFoundException(`Utilisateur ${id} introuvable`);
    }
    return user;
  }
}

/** L'entité du domaine : tout l'enregistrement **sauf** le secret. */
function toUser({ passwordHash: _passwordHash, ...user }: PersistedUser): User {
  return user;
}
