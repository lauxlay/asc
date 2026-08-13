import { randomUUID } from "node:crypto";
import {
  type AnalyzeImportResponse,
  type CommitImportResponse,
  type ImportPreviewRow,
  MAX_CSV_ROWS,
} from "@asc/contracts";
import {
  buildImportPlan,
  type ColumnMapping,
  DomainError,
  type Id,
  type ImportPlan,
  parseCsv,
  type Site,
  suggestColumnMapping,
  type Unit,
} from "@asc/domain";
import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { SITE_REPOSITORY, UNIT_REPOSITORY } from "../../common/tokens.js";
import type { SiteRepository } from "../sites/site.repository.js";
import type { UnitRepository } from "../units/unit.repository.js";

/** Nombre de lignes d'aperçu : de quoi vérifier la correspondance, pas de quoi relire le fichier. */
const PREVIEW_SIZE = 5;

/**
 * Import du parc depuis un CSV (spec 004).
 *
 * Le service n'a pas de stockage à lui : il lit le parc existant pour détecter
 * les doublons et réutiliser les immeubles, puis écrit par les mêmes ports que
 * la saisie manuelle. Un import n'est rien d'autre qu'une saisie en masse — il
 * ne doit pas pouvoir produire ce que la saisie interdirait.
 *
 * Toute la logique de lecture et de validation vit dans `@asc/domain` : ici on
 * orchestre, on ne décide pas.
 */
@Injectable()
export class ParcImportService {
  constructor(
    @Inject(SITE_REPOSITORY) private readonly sites: SiteRepository,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepository,
  ) {}

  /** Analyse sans rien écrire : deux analyses laissent le parc identique. */
  async analyze(
    tenantId: Id,
    csv: string,
    requested: ColumnMapping | null,
  ): Promise<AnalyzeImportResponse> {
    const table = parseCsv(csv);
    this.#assertRowCount(table.rows.length);

    const suggestedMapping = suggestColumnMapping(table.headers);
    const mapping = requested ?? suggestedMapping;
    const { plan, siteByKey } = await this.#plan(tenantId, table, mapping);

    return {
      separator: table.separator,
      headers: [...table.headers],
      mapping,
      suggestedMapping,
      rowCount: table.rows.length,
      createdSiteCount: plan.createdSiteCount,
      reusedSiteCount: plan.reusedSiteCount,
      unitCount: plan.units.length,
      issues: plan.issues.map((issue) => ({ ...issue })),
      preview: plan.units.slice(0, PREVIEW_SIZE).map((unit): ImportPreviewRow => {
        const site = siteByKey(plan, unit.siteKey);
        return {
          lineNumber: unit.lineNumber,
          siteName: site.name,
          addressLine: site.addressLine,
          postalCode: site.postalCode,
          city: site.city,
          reference: unit.reference,
          commissionedOn: unit.commissionedOn,
          lastStatutoryInspectionOn: unit.lastStatutoryInspectionOn,
          siteIsNew: site.existingId === null,
        };
      }),
    };
  }

  /**
   * Exécute l'import, en entier ou pas du tout (spec 004, R4.3).
   *
   * La validation est intégralement faite avant la première écriture : un
   * fichier fautif ne laisse aucune trace.
   */
  async commit(tenantId: Id, csv: string, mapping: ColumnMapping): Promise<CommitImportResponse> {
    const table = parseCsv(csv);
    this.#assertRowCount(table.rows.length);

    const { plan } = await this.#plan(tenantId, table, mapping);
    if (plan.issues.length > 0) {
      throw new UnprocessableEntityException({
        message: "Le fichier comporte des erreurs : rien n'a été importé",
        issues: plan.issues,
      });
    }

    const siteIdByKey = new Map<string, Id>();
    for (const planned of plan.sites) {
      if (planned.existingId !== null) {
        siteIdByKey.set(planned.key, planned.existingId);
        continue;
      }
      const site: Site = {
        id: randomUUID(),
        tenantId,
        // Le rattachement client se fait ensuite depuis l'écran client (R8).
        customerId: null,
        name: planned.name,
        addressLine: planned.addressLine,
        postalCode: planned.postalCode,
        city: planned.city,
      };
      await this.sites.save(site);
      siteIdByKey.set(planned.key, site.id);
    }

    for (const planned of plan.units) {
      const siteId = siteIdByKey.get(planned.siteKey);
      if (siteId === undefined) {
        // Inatteignable : chaque appareil du plan vient d'une ligne qui a créé
        // sa clé d'immeuble. On préfère échouer bruyamment à écrire un orphelin.
        throw new DomainError(`Immeuble introuvable pour la clé ${planned.siteKey}`);
      }
      const unit: Unit = {
        id: randomUUID(),
        tenantId,
        siteId,
        reference: planned.reference,
        commissionedOn: planned.commissionedOn,
        lastStatutoryInspectionOn: planned.lastStatutoryInspectionOn,
      };
      await this.units.save(unit);
    }

    return {
      createdSiteCount: plan.createdSiteCount,
      reusedSiteCount: plan.reusedSiteCount,
      createdUnitCount: plan.units.length,
    };
  }

  /** Le plan est construit sur le parc du tenant appelant, jamais au-delà (R7). */
  async #plan(
    tenantId: Id,
    table: Parameters<typeof buildImportPlan>[0],
    mapping: ColumnMapping,
  ): Promise<{
    readonly plan: ImportPlan;
    readonly siteByKey: (plan: ImportPlan, key: string) => ImportPlan["sites"][number];
  }> {
    const [sites, units] = await Promise.all([
      this.sites.findAll(tenantId),
      this.units.findAll(tenantId),
    ]);
    const plan = buildImportPlan(table, mapping, sites, units);

    return {
      plan,
      siteByKey: (current, key) => {
        const site = current.sites.find((candidate) => candidate.key === key);
        if (site === undefined) {
          throw new DomainError(`Immeuble introuvable pour la clé ${key}`);
        }
        return site;
      },
    };
  }

  #assertRowCount(rowCount: number): void {
    if (rowCount > MAX_CSV_ROWS) {
      throw new UnprocessableEntityException({
        message: `Le fichier dépasse ${MAX_CSV_ROWS} lignes`,
        issues: [],
      });
    }
  }
}
