import { addDays, addMonths, compareIsoDate, type IsoDate, isAfter } from "../date/iso-date.js";
import type { Contract, Id } from "../entities.js";

/**
 * Calendrier prévisionnel des visites périodiques (spec 009, R1).
 *
 * Fonction pure : elle dit à quelles dates les visites d'un contrat **devraient**
 * tomber, jamais ce qui a réellement été fait. La conformité, elle, se calcule
 * à partir des visites réalisées (`compliance/deadlines.ts`) — les deux ne
 * doivent pas être confondues.
 */

/**
 * Intervalle de génération, en jours.
 *
 * Le réglementaire impose « **au moins une** visite toutes les 6 semaines »
 * (42 jours). Générer pile à 42 jours ne laisserait aucune marge : une visite
 * reportée d'un jour met l'appareil en infraction. Cinq semaines laissent une
 * semaine de rattrapage — arbitrage produit consigné en B7 du registre des
 * décisions métier.
 */
export const VISIT_SCHEDULE_INTERVAL_DAYS = 35;

/** Profondeur du calendrier : au-delà, on planifierait un contrat résiliable. */
export const VISIT_SCHEDULE_HORIZON_MONTHS = 12;

/** Une échéance de visite à créer : un appareil, un jour. */
export interface ScheduledVisit {
  readonly unitId: Id;
  readonly dueOn: IsoDate;
}

/**
 * Échéances d'un appareil couvert, du plus proche au plus lointain.
 *
 * La série est **ancrée sur la prise d'effet du contrat** : la n-ième visite
 * tombe à `startsOn + n × 35 jours`. Deux générations à des dates différentes
 * produisent donc exactement les mêmes jours, ce qui rend l'idempotence
 * possible sans marqueur en base.
 */
function dueDatesFor(contract: Contract, generatedOn: IsoDate): IsoDate[] {
  const horizon = addMonths(generatedOn, VISIT_SCHEDULE_HORIZON_MONTHS);
  // La fin de contrat borne le calendrier : on ne planifie pas au-delà de
  // l'engagement (R1.4).
  const last =
    contract.endsOn !== null && compareIsoDate(contract.endsOn, horizon) < 0
      ? contract.endsOn
      : horizon;

  const dates: IsoDate[] = [];
  let due = addDays(contract.startsOn, VISIT_SCHEDULE_INTERVAL_DAYS);
  while (!isAfter(due, last)) {
    // Le passé ne se planifie pas (R1.5) : un contrat de trois ans reprend à sa
    // prochaine échéance à venir, sans réécrire l'historique.
    if (!isAfter(generatedOn, due)) {
      dates.push(due);
    }
    due = addDays(due, VISIT_SCHEDULE_INTERVAL_DAYS);
  }
  return dates;
}

/**
 * Calendrier complet du contrat : une série par appareil couvert.
 *
 * Trié par date puis par appareil, pour que deux appels rendent exactement la
 * même liste.
 */
export function scheduleVisits(contract: Contract, generatedOn: IsoDate): ScheduledVisit[] {
  const dates = dueDatesFor(contract, generatedOn);
  return dates.flatMap((dueOn) => contract.unitIds.map((unitId) => ({ unitId, dueOn })));
}

/**
 * Retire du calendrier les échéances déjà couvertes (spec 009, R3).
 *
 * `covered` est l'ensemble des couples (appareil, jour) qui portent déjà une
 * visite, **quel que soit son statut** : une visite annulée ne se recrée pas,
 * une visite planifiée ne se duplique pas.
 */
export function missingVisits(
  planned: readonly ScheduledVisit[],
  covered: ReadonlySet<string>,
): ScheduledVisit[] {
  return planned.filter((visit) => !covered.has(visitKey(visit.unitId, visit.dueOn)));
}

/** Clé naturelle d'une visite : l'appareil et le jour où elle est due. */
export function visitKey(unitId: Id, dueOn: IsoDate): string {
  return `${unitId} ${dueOn}`;
}
