import type { SearchQuery, SearchResponse, SearchResult } from "@asc/contracts";
import {
  type Id,
  MAX_SEARCH_RESULTS,
  matchQualityOf,
  type RankedResult,
  rankSearchResults,
} from "@asc/domain";
import { Inject, Injectable } from "@nestjs/common";
import {
  CONTRACT_REPOSITORY,
  CUSTOMER_REPOSITORY,
  SITE_REPOSITORY,
  UNIT_REPOSITORY,
  WORK_ORDER_REPOSITORY,
} from "../../common/tokens.js";
import type { ContractRepository } from "../contracts/contract.repository.js";
import type { CustomerRepository } from "../customers/customer.repository.js";
import type { SiteRepository } from "../sites/site.repository.js";
import type { UnitRepository } from "../units/unit.repository.js";
import type { WorkOrderRepository } from "../work-orders/work-order.repository.js";

/**
 * Recherche transverse (spec 010).
 *
 * Le service **assemble et balaie** ; il ne décide ni de la correspondance ni
 * de l'ordre — les deux vivent dans `@asc/domain`. Sa part propre est de savoir
 * quels champs sont cherchables, comment se lit un résultat, et où il mène.
 *
 * Le balayage est complet à chaque appel : c'est assumé pour la Phase 0 et
 * documenté dans la spec. Le jour du passage en base, la même règle de
 * correspondance devient une clause `WHERE`.
 */

/** Un résultat classable, augmenté de quoi l'afficher et l'ouvrir. */
interface Candidate extends RankedResult {
  readonly id: Id;
  readonly sublabel: string;
  readonly targetId: Id;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrders: WorkOrderRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
  ) {}

  async search(tenantId: Id, { q }: SearchQuery): Promise<SearchResponse> {
    const [sites, units, customers, workOrders, contracts] = await Promise.all([
      this.sites.findAll(tenantId),
      this.units.findAll(tenantId),
      this.customers.findAll(tenantId),
      this.workOrders.findAll(tenantId),
      this.contracts.findAll(tenantId),
    ]);

    const siteById = new Map(sites.map((site) => [site.id, site]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));

    /** L'immeuble d'un appareil, en une ligne — ce qui situe le résultat. */
    const siteLabelOf = (siteId: Id): string => {
      const site = siteById.get(siteId);
      return site === undefined ? "Immeuble inconnu" : `${site.name} — ${site.city}`;
    };

    const candidates: Candidate[] = [];

    for (const site of sites) {
      const quality = matchQualityOf([site.name, site.addressLine, site.postalCode, site.city], q);
      if (quality !== null) {
        candidates.push({
          kind: "site",
          quality,
          id: site.id,
          label: site.name,
          sublabel: `${site.addressLine}, ${site.postalCode} ${site.city}`,
          targetId: site.id,
        });
      }
    }

    for (const unit of units) {
      const site = siteById.get(unit.siteId);
      // Cherchable **par le nom ou l'adresse de son immeuble** : un gardien dit
      // « c'est aux Tilleuls », jamais « c'est l'appareil A » (spec 010).
      const quality = matchQualityOf(
        [unit.reference, site?.name, site?.addressLine, site?.city],
        q,
      );
      if (quality !== null) {
        candidates.push({
          kind: "unit",
          quality,
          id: unit.id,
          label: unit.reference,
          sublabel: siteLabelOf(unit.siteId),
          // Un appareil n'a pas de page : on ouvre celle de son immeuble.
          targetId: unit.siteId,
        });
      }
    }

    for (const customer of customers) {
      const quality = matchQualityOf([customer.name], q);
      if (quality !== null) {
        candidates.push({
          kind: "customer",
          quality,
          id: customer.id,
          label: customer.name,
          sublabel: "Client",
          targetId: customer.id,
        });
      }
    }

    for (const workOrder of workOrders) {
      const unit = unitById.get(workOrder.unitId);
      const site = unit === undefined ? undefined : siteById.get(unit.siteId);
      const quality = matchQualityOf(
        [workOrder.reference, workOrder.summary, site?.name, site?.addressLine],
        q,
      );
      if (quality !== null) {
        candidates.push({
          kind: "work_order",
          quality,
          id: workOrder.id,
          label: workOrder.reference,
          sublabel:
            unit === undefined
              ? workOrder.summary
              : `${workOrder.summary} · ${siteLabelOf(unit.siteId)}`,
          targetId: workOrder.id,
        });
      }
    }

    for (const contract of contracts) {
      const quality = matchQualityOf([contract.reference], q);
      if (quality !== null) {
        candidates.push({
          kind: "contract",
          quality,
          id: contract.id,
          label: contract.reference,
          sublabel: `Contrat · ${contract.unitIds.length} appareil(s)`,
          targetId: contract.id,
        });
      }
    }

    const ranked = rankSearchResults(candidates);
    return {
      items: ranked.map(toResult),
      // Le plafond a-t-il écarté quelque chose ? Sans ce drapeau, l'utilisateur
      // croirait avoir tout vu au lieu de préciser sa recherche (R3.3).
      truncated: candidates.length > MAX_SEARCH_RESULTS,
    };
  }
}

/**
 * La **qualité** de correspondance ne sort pas de l'API : elle a servi à
 * classer, elle n'a rien à dire au client.
 */
function toResult(candidate: Candidate): SearchResult {
  return {
    kind: candidate.kind,
    id: candidate.id,
    label: candidate.label,
    sublabel: candidate.sublabel,
    targetId: candidate.targetId,
  };
}
