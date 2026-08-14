import type { IsoDate } from "./date/iso-date.js";

/**
 * Entités du domaine — glossaire FR→EN figé
 * (`docs/03-application/03-modele-donnees.md`).
 *
 * Types purs, sans dépendance framework. `tenantId` est présent dès le jour 1
 * sur chaque enregistrement (ADR-001), même avec un seul tenant.
 */

/** Identifiant applicatif (UUID généré par l'app, jamais un auto-increment — ADR-001). */
export type Id = string;

/** Rôles applicatifs (`docs/03-application/03-modele-donnees.md`). */
export const USER_ROLES = ["admin", "dispatcher", "technician", "accountant"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Utilisateur de la société de maintenance.
 *
 * Le domaine connaît l'identité et le rôle, jamais les identifiants secrets :
 * le mot de passe haché est un détail de la couche de persistance.
 */
export interface User {
  readonly id: Id;
  readonly tenantId: Id;
  readonly email: string;
  readonly role: UserRole;
}

/**
 * Types de client (`docs/03-application/03-modele-donnees.md`).
 *
 * `managing_agent` = syndic · `condominium` = copropriété ·
 * `business` = professionnel (entreprise, hôtel, commerce propriétaire de son
 * immeuble) · `individual` = particulier.
 *
 * `business` et non `company` : `company` désigne déjà le tenant — la société
 * de maintenance elle-même — dans le glossaire figé.
 */
export const CUSTOMER_TYPES = ["managing_agent", "condominium", "business", "individual"] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];

/** Client donneur d'ordre : syndic, copropriété ou particulier. */
export interface Customer {
  readonly id: Id;
  readonly tenantId: Id;
  readonly name: string;
  readonly type: CustomerType;
}

/**
 * Interlocuteur chez un client.
 *
 * `siteId` renseigné = contact d'un immeuble précis, le gardien typiquement ;
 * `null` = interlocuteur du client en général (spec 003, R2).
 */
export interface Contact {
  readonly id: Id;
  readonly tenantId: Id;
  readonly customerId: Id;
  readonly siteId: Id | null;
  readonly name: string;
  /** Texte libre : « Gardien », « Gestionnaire »… (spec 003, R2.3). */
  readonly role: string;
  readonly email: string | null;
  readonly phone: string | null;
}

/**
 * Immeuble accueillant un ou plusieurs appareils.
 *
 * `customerId` est nullable : un immeuble peut être saisi avant que son syndic
 * ne soit connu, et le parc importé avant les clients (spec 003, R1).
 */
export interface Site {
  readonly id: Id;
  readonly tenantId: Id;
  /** Client donneur d'ordre, `null` tant qu'il n'est pas rattaché. */
  readonly customerId: Id | null;
  /** Nom d'usage de l'immeuble : « Résidence Les Tilleuls ». */
  readonly name: string;
  /** Numéro et voie. */
  readonly addressLine: string;
  readonly postalCode: string;
  readonly city: string;
}

/** Appareil (ascenseur). */
export interface Unit {
  readonly id: Id;
  readonly tenantId: Id;
  /** Référence vérifiée vers un `Site` du même tenant (spec 002, R1). */
  readonly siteId: Id;
  /** Repère de l'appareil dans son immeuble : « Ascenseur A ». Non unique. */
  readonly reference: string;
  /** Mise en service. Point de départ du quinquennal à défaut de contrôle connu. */
  readonly commissionedOn: IsoDate | null;
  /** Dernier contrôle technique quinquennal réalisé. */
  readonly lastStatutoryInspectionOn: IsoDate | null;
}

/**
 * Contrat d'entretien.
 *
 * `minimal` / `extended` : contrats types de l'arrêté du 7 novembre 2012
 * (`docs/02-produit/05-conformite-reglementaire.md`). Le type ne joue que sur
 * les pièces incluses, jamais sur les échéances.
 */
export interface Contract {
  readonly id: Id;
  readonly tenantId: Id;
  /** Numéro de contrat : « CT-2026-014 ». Non unique, comme les repères d'appareils. */
  readonly reference: string;
  readonly type: ContractType;
  readonly unitIds: readonly Id[];
  readonly startsOn: IsoDate;
  /** `null` = en cours (tacite reconduction). */
  readonly endsOn: IsoDate | null;
}

/** Contrats types de l'arrêté du 7 novembre 2012. */
export const CONTRACT_TYPES = ["minimal", "extended"] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

/**
 * Types d'ordre de travail (spec 007, R2).
 *
 * Le modèle de données prévoit aussi `works` et `inspection` : ils arriveront
 * avec les features qui les produisent (devis→travaux en L3.1, contrôle
 * technique en L2.6). Les déclarer vides maintenant serait spéculatif.
 */
export const WORK_ORDER_TYPES = ["visit", "breakdown", "repair"] as const;

export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];

/** Statuts d'un ordre de travail. `done` et `cancelled` sont terminaux (R3.2). */
export const WORK_ORDER_STATUSES = ["new", "in_progress", "done", "cancelled"] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

/**
 * Criticité. `entrapment` — personne bloquée en cabine — est le P0 du produit,
 * la seule criticité qui porte la couleur d'alerte
 * (`docs/02-produit/07-principes-ux.md`, règle 4).
 */
export const WORK_ORDER_PRIORITIES = ["entrapment", "urgent", "normal"] as const;

export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

/**
 * Réponses au script de désincarcération (spec 007, R3).
 *
 * Chaque réponse est indépendamment facultative. `null` signifie « pas encore
 * demandé » et se distingue de `false` qui signifie « demandé, la réponse est
 * non » : un dispatcher qui n'a pas eu le temps de poser la question ne doit
 * pas apparaître comme ayant constaté l'absence d'urgence médicale.
 */
export interface EntrapmentDetails {
  readonly medicalEmergency: boolean | null;
  readonly peopleCount: number | null;
  readonly betweenFloors: boolean | null;
}

/**
 * Ordre de travail : l'unité de production de l'ascensoriste.
 *
 * Pas d'`assignee` ni de `scheduledAt` à ce stade : ils arrivent avec le
 * planning qui les remplit (L1.7). Un champ vide que rien n'écrit serait un
 * champ mort.
 */
export interface WorkOrder {
  readonly id: Id;
  readonly tenantId: Id;
  /** Numéro lisible « OT-2026-00042 » : un UUID ne se cite pas au téléphone. */
  readonly reference: string;
  readonly type: WorkOrderType;
  readonly status: WorkOrderStatus;
  readonly priority: WorkOrderPriority;
  readonly unitId: Id;
  /** Ce que dit l'appelant, en une ligne. */
  readonly summary: string;
  /** Contact sur place et consigne d'accès, pré-rempli depuis l'immeuble. */
  readonly onSiteContact: string | null;
  /** OT dont celui-ci prend la suite — « rouvrir » sans rouvrir (spec 007, R5). */
  readonly followUpOf: Id | null;
  /**
   * Nombre de signalements reçus pour cet incident (spec 007, R2).
   *
   * Vaut 1 à la création. Cinq signalements en deux heures ne décrivent pas la
   * même urgence qu'un seul : c'est un signal de pression pour le dispatcher.
   */
  readonly reportCount: number;
  /**
   * Instant du **premier** signalement, et non jour calendaire.
   *
   * Ce n'est pas une entorse à la règle des jours (spec 001, R6) : celle-ci
   * concerne le calcul d'échéances. Un délai de désincarcération se mesure en
   * minutes.
   */
  readonly reportedAt: string;
  /** Instant du dernier signalement rattaché. Égal à `reportedAt` au départ. */
  readonly lastReportedAt: string;
  /** Renseigné uniquement quand `priority` vaut `entrapment`. */
  readonly entrapment: EntrapmentDetails | null;
}

/** Visite périodique. `completedOn` à `null` = planifiée, pas encore réalisée. */
export interface MaintenanceVisit {
  readonly id: Id;
  readonly tenantId: Id;
  readonly unitId: Id;
  readonly completedOn: IsoDate | null;
}
