/**
 * Erreur métier du domaine : une précondition ou un invariant est violé.
 *
 * Le domaine ne connaît ni HTTP ni stockage : c'est aux frontières de traduire
 * ces erreurs en réponses (400/409…).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
