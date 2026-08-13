import type { ComplianceQuery, ComplianceResponse, ComplianceRow } from "@asc/contracts";
import {
  activeContractFor,
  type ComplianceDeadline,
  computeDeadlines,
  type DeadlineKind,
  type Id,
  type IsoDate,
  isoDate,
  worstDeadlineStatus,
} from "@asc/domain";
import { Inject, Injectable } from "@nestjs/common";
import { CONTRACT_REPOSITORY, SITE_REPOSITORY, UNIT_REPOSITORY } from "../../common/tokens.js";
import type { ContractRepository } from "../contracts/contract.repository.js";
import type { SiteRepository } from "../sites/site.repository.js";
import type { UnitRepository } from "../units/unit.repository.js";

/**
 * Tableau de conformité du parc (spec 006).
 *
 * Le service part des **appareils**, pas des échéances : c'est ce qui garantit
 * qu'un appareil sans contrat ni date connue reste visible. Un tableau qui ne
 * listerait que les échéances ferait disparaître exactement les appareils les
 * plus problématiques.
 *
 * Aucune règle de date n'est recalculée ici : `computeDeadlines` décide, ce
 * service assemble.
 */
@Injectable()
export class ComplianceService {
  constructor(
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
  ) {}

  async overview(tenantId: Id, query: ComplianceQuery): Promise<ComplianceResponse> {
    const evaluatedOn = today();
    const [units, sites, contracts] = await Promise.all([
      this.units.findAll(tenantId),
      this.sites.findAll(tenantId),
      this.contracts.findAll(tenantId),
    ]);
    const siteById = new Map(sites.map((site) => [site.id, site]));

    const rows = units.map((unit): ComplianceRow => {
      const contract = activeContractFor(unit, contracts, evaluatedOn);
      // Aucune visite n'est encore enregistrée (collection absente avant L1.6) :
      // le compteur part de la prise d'effet du contrat (spec 001, R1.3).
      const deadlines = computeDeadlines(unit, contract, [], evaluatedOn);
      const site = siteById.get(unit.siteId);

      return {
        unitId: unit.id,
        unitReference: unit.reference,
        siteId: unit.siteId,
        siteName: site?.name ?? "Immeuble inconnu",
        contractId: contract?.id ?? null,
        contractReference: contract?.reference ?? null,
        status: worstDeadlineStatus(deadlines) ?? "unknown",
        visit: cellOf(deadlines, "visit_6w"),
        inspection: cellOf(deadlines, "inspection_5y"),
      };
    });

    return {
      evaluatedOn,
      // Les compteurs décrivent le parc entier : filtrer la vue ne doit pas
      // changer le nombre d'appareils en retard qu'on annonce.
      summary: {
        total: rows.length,
        overdue: rows.filter((row) => row.status === "overdue").length,
        dueSoon: rows.filter((row) => row.status === "due_soon").length,
        ok: rows.filter((row) => row.status === "ok").length,
        unknown: rows.filter((row) => row.status === "unknown").length,
        withoutContract: rows.filter((row) => row.contractId === null).length,
      },
      items: rows.filter((row) => matches(row, query.status)),
    };
  }
}

/** `without_contract` croise les statuts au lieu d'en être un (spec 006, R5.3). */
function matches(row: ComplianceRow, status: ComplianceQuery["status"]): boolean {
  if (status === undefined) {
    return true;
  }
  if (status === "without_contract") {
    return row.contractId === null;
  }
  return row.status === status;
}

function cellOf(
  deadlines: readonly ComplianceDeadline[],
  kind: DeadlineKind,
): ComplianceRow["visit"] {
  const found = deadlines.find((deadline) => deadline.kind === kind);
  if (found === undefined) {
    return null;
  }
  return { kind: found.kind, dueOn: found.dueOn, status: found.status };
}

/** Jour calendaire UTC courant — la seule lecture d'horloge du parcours. */
function today(): IsoDate {
  return isoDate(new Date().toISOString().slice(0, 10));
}
