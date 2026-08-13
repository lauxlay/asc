import { isActiveOn } from "../contracts/contract-rules.js";
import type { IsoDate } from "../date/iso-date.js";
import type { Contract, Unit } from "../entities.js";
import type { ComplianceDeadline, DeadlineStatus } from "./deadlines.js";

/**
 * Lecture de la conformité à l'échelle du parc (spec 006).
 *
 * Fonctions pures d'agrégation : elles ne calculent aucune date — c'est le rôle
 * de `computeDeadlines` — mais répondent à « quel contrat s'applique ? » et
 * « où en est cet appareil, tout compte fait ? ».
 */

/**
 * Contrat couvrant l'appareil au jour donné, ou `null` (spec 006, R2).
 *
 * La spec 005 garantit qu'un appareil n'est couvert que par un contrat à la
 * fois : la recherche s'arrête donc au premier trouvé, et le résultat est
 * déterministe. Si cette garantie tombait, ce serait ici que ça se verrait.
 */
export function activeContractFor(
  unit: Unit,
  contracts: readonly Contract[],
  on: IsoDate,
): Contract | null {
  return (
    contracts.find(
      (contract) =>
        contract.tenantId === unit.tenantId &&
        contract.unitIds.includes(unit.id) &&
        isActiveOn(contract, on),
    ) ?? null
  );
}

/** Du plus grave au plus anodin : c'est l'ordre dans lequel le dispatcher lit. */
const SEVERITY: readonly DeadlineStatus[] = ["overdue", "due_soon", "ok"];

/**
 * Statut de synthèse d'un appareil : le **pire** de ses échéances (R3.1).
 *
 * `null` quand aucune échéance n'est calculable — l'appareil n'est alors ni
 * conforme ni en retard, on n'en sait rien (R3.2). Afficher « à jour » dans ce
 * cas serait le mensonge le plus coûteux du produit.
 */
export function worstDeadlineStatus(
  deadlines: readonly ComplianceDeadline[],
): DeadlineStatus | null {
  for (const status of SEVERITY) {
    if (deadlines.some((deadline) => deadline.status === status)) {
      return status;
    }
  }
  return null;
}
