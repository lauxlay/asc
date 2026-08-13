import type { ComplianceQuery, ComplianceRow } from "@asc/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getCompliance } from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import { DEADLINE_KIND_LABELS } from "@/lib/contract-labels";

/**
 * Tableau de conformité du parc (spec 006).
 *
 * L'écran que le dispatcher ouvre le lundi matin : « qu'est-ce qui est en
 * retard ? ». Une ligne par **appareil**, jamais par échéance — un appareil
 * sans contrat ni date connue doit rester visible, sinon les plus
 * problématiques passeraient pour conformes.
 */

type Filter = ComplianceQuery["status"];

const ROW_STATUS_LABELS: Readonly<Record<ComplianceRow["status"], string>> = {
  overdue: "En retard",
  due_soon: "Bientôt due",
  ok: "À jour",
  unknown: "Inconnu",
};

/** Le rouge du retard est la seule couleur métier : c'est l'alerte réglementaire. */
const ROW_STATUS_CLASS: Readonly<Record<ComplianceRow["status"], string>> = {
  overdue: "font-medium text-[var(--color-destructive)]",
  due_soon: "font-medium",
  ok: "text-[var(--color-muted-foreground)]",
  unknown: "text-[var(--color-muted-foreground)] italic",
};

export function CompliancePage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const [filter, setFilter] = useState<Filter>(undefined);

  const { data, isPending, error } = useQuery({
    queryKey: ["compliance", filter ?? "all"],
    queryFn: () => getCompliance(token, filter),
    enabled: token !== "",
    placeholderData: keepPreviousData,
  });

  const counters: readonly { key: Filter; label: string; value: number; accent: boolean }[] =
    data === undefined
      ? []
      : [
          { key: "overdue", label: "En retard", value: data.summary.overdue, accent: true },
          { key: "due_soon", label: "Bientôt dues", value: data.summary.dueSoon, accent: false },
          { key: "ok", label: "À jour", value: data.summary.ok, accent: false },
          { key: "unknown", label: "Inconnu", value: data.summary.unknown, accent: false },
          {
            key: "without_contract",
            label: "Sans contrat",
            value: data.summary.withoutContract,
            accent: false,
          },
        ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conformité</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {data === undefined
            ? "Échéances réglementaires du parc."
            : `${data.summary.total} appareil(s) · calculé au ${data.evaluatedOn}, jamais stocké.`}
        </p>
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error.message}
        </p>
      )}

      {counters.length > 0 && (
        <div data-testid="compliance-counters" className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={filter === undefined ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(undefined)}
          >
            Tout ({data?.summary.total ?? 0})
          </Button>
          {counters.map((counter) => (
            <Button
              key={counter.key}
              type="button"
              variant={filter === counter.key ? "default" : "outline"}
              size="sm"
              className={
                counter.accent && counter.value > 0 && filter !== counter.key
                  ? "text-[var(--color-destructive)]"
                  : undefined
              }
              onClick={() => setFilter(counter.key)}
            >
              {counter.label} ({counter.value})
            </Button>
          ))}
        </div>
      )}

      {isPending && <p className="text-sm text-[var(--color-muted-foreground)]">Chargement…</p>}

      {data !== undefined &&
        (data.items.length === 0 ? (
          <p
            data-testid="compliance-empty"
            className="text-sm text-[var(--color-muted-foreground)]"
          >
            {data.summary.total === 0
              ? "Aucun appareil dans le parc."
              : "Aucun appareil dans cette catégorie."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="py-1 pr-4 font-medium">Appareil</th>
                  <th className="py-1 pr-4 font-medium">Immeuble</th>
                  <th className="py-1 pr-4 font-medium">Contrat</th>
                  <th className="py-1 pr-4 font-medium">Visite</th>
                  <th className="py-1 pr-4 font-medium">Quinquennal</th>
                  <th className="py-1 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody data-testid="compliance-rows">
                {data.items.map((row) => (
                  <tr key={row.unitId} className="border-t border-[var(--color-border)]">
                    <td className="py-1 pr-4">{row.unitReference}</td>
                    <td className="py-1 pr-4">
                      <Link
                        to="/sites/$siteId"
                        params={{ siteId: row.siteId }}
                        className="hover:underline"
                      >
                        {row.siteName}
                      </Link>
                    </td>
                    <td className="py-1 pr-4">
                      {row.contractId === null ? (
                        <span className="text-[var(--color-destructive)]">Aucun</span>
                      ) : (
                        <Link
                          to="/contrats/$contractId"
                          params={{ contractId: row.contractId }}
                          className="hover:underline"
                        >
                          {row.contractReference}
                        </Link>
                      )}
                    </td>
                    <td className="py-1 pr-4">
                      {row.visit === null ? "—" : row.visit.dueOn}
                      {row.visit !== null && (
                        <span className="sr-only"> {DEADLINE_KIND_LABELS[row.visit.kind]}</span>
                      )}
                    </td>
                    <td className="py-1 pr-4">
                      {row.inspection === null ? "—" : row.inspection.dueOn}
                    </td>
                    <td className={`py-1 ${ROW_STATUS_CLASS[row.status]}`}>
                      {ROW_STATUS_LABELS[row.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
