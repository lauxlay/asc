import type { WorkOrderListQuery } from "@asc/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { listSites, listUnits, listWorkOrders } from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import {
  timeAgo,
  WORK_ORDER_PRIORITY_CLASS,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_TYPE_LABELS,
} from "@/lib/work-order-labels";

/**
 * Liste des ordres de travail (spec 007, R9).
 *
 * Du plus récent au plus ancien : un dispatcher veut voir ce qui vient
 * d'arriver, pas ce qu'il a saisi il y a six mois.
 */

type Filter = "all" | "open" | WorkOrderListQuery["status"];

export function WorkOrdersPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const [filter, setFilter] = useState<Filter>("open");

  const query: WorkOrderListQuery =
    filter === "all" ? {} : filter === "open" ? { open: "true" } : { status: filter };

  const { data, isPending, error } = useQuery({
    queryKey: ["work-orders", filter],
    queryFn: () => listWorkOrders(token, query),
    enabled: token !== "",
    placeholderData: keepPreviousData,
  });

  const units = useQuery({
    queryKey: ["units"],
    queryFn: () => listUnits(token),
    enabled: token !== "",
  });

  const sites = useQuery({
    queryKey: ["sites", ""],
    queryFn: () => listSites(token),
    enabled: token !== "",
  });

  const unitById = new Map((units.data?.items ?? []).map((unit) => [unit.id, unit]));
  const siteById = new Map((sites.data?.items ?? []).map((site) => [site.id, site]));

  const filters: readonly { key: Filter; label: string }[] = [
    { key: "open", label: "À traiter" },
    { key: "in_progress", label: "En cours" },
    { key: "done", label: "Clôturés" },
    { key: "all", label: "Tous" },
  ];

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OT</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Ordres de travail, du plus récent au plus ancien.
          </p>
        </div>
        <Button asChild>
          <Link to="/ot/nouveau">Nouvel OT</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((entry) => (
          <Button
            key={entry.key}
            type="button"
            variant={filter === entry.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(entry.key)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {isPending && <p className="text-sm text-[var(--color-muted-foreground)]">Chargement…</p>}

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error.message}
        </p>
      )}

      {data !== undefined &&
        (data.items.length === 0 ? (
          <p
            data-testid="work-orders-empty"
            className="text-sm text-[var(--color-muted-foreground)]"
          >
            Aucun OT dans cette catégorie.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="py-1 pr-4 font-medium">N°</th>
                  <th className="py-1 pr-4 font-medium">Appareil</th>
                  <th className="py-1 pr-4 font-medium">Objet</th>
                  <th className="py-1 pr-4 font-medium">Criticité</th>
                  <th className="py-1 pr-4 font-medium">Statut</th>
                  <th className="py-1 font-medium">Signalé</th>
                </tr>
              </thead>
              <tbody data-testid="work-orders-rows">
                {data.items.map((workOrder) => {
                  const unit = unitById.get(workOrder.unitId);
                  const site = unit === undefined ? undefined : siteById.get(unit.siteId);
                  return (
                    <tr key={workOrder.id} className="border-t border-[var(--color-border)]">
                      <td className="py-1 pr-4">
                        <Link
                          to="/ot/$workOrderId"
                          params={{ workOrderId: workOrder.id }}
                          className="font-medium hover:underline"
                        >
                          {workOrder.reference}
                        </Link>
                      </td>
                      <td className="py-1 pr-4">
                        {site?.name ?? "Immeuble inconnu"} — {unit?.reference ?? "?"}
                      </td>
                      <td className="py-1 pr-4">
                        {WORK_ORDER_TYPE_LABELS[workOrder.type]} · {workOrder.summary}
                        {workOrder.reportCount > 1 && (
                          <span className="font-medium">
                            {" "}
                            ({workOrder.reportCount} signalements)
                          </span>
                        )}
                      </td>
                      <td className={`py-1 pr-4 ${WORK_ORDER_PRIORITY_CLASS[workOrder.priority]}`}>
                        {WORK_ORDER_PRIORITY_LABELS[workOrder.priority]}
                      </td>
                      <td className="py-1 pr-4">{WORK_ORDER_STATUS_LABELS[workOrder.status]}</td>
                      <td className="py-1 text-[var(--color-muted-foreground)]">
                        {timeAgo(workOrder.reportedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
