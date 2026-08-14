import type { RequestableWorkOrderStatus } from "@asc/contracts";
import { allowedTransitionsFrom } from "@asc/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getWorkOrder,
  getWorkOrderChain,
  listSites,
  listUnits,
  updateWorkOrder,
} from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import {
  timeAgo,
  WORK_ORDER_PRIORITY_CLASS,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_TYPE_LABELS,
} from "@/lib/work-order-labels";

/**
 * Fiche d'un ordre de travail (spec 007).
 *
 * Les boutons de statut sont ceux que le domaine autorise depuis le statut
 * courant : l'écran ne propose jamais une transition que l'API refusera.
 */
export function WorkOrderDetailPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const { workOrderId } = useParams({ from: "/authenticated/ot/$workOrderId" });
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);

  const workOrder = useQuery({
    queryKey: ["work-orders", workOrderId],
    queryFn: () => getWorkOrder(token, workOrderId),
    enabled: token !== "",
  });

  const chain = useQuery({
    queryKey: ["work-orders", workOrderId, "chain"],
    queryFn: () => getWorkOrderChain(token, workOrderId),
    enabled: token !== "",
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

  const statusMutation = useMutation({
    mutationFn: (status: RequestableWorkOrderStatus) =>
      updateWorkOrder(token, workOrderId, { status }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["work-orders"] });
    },
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Changement de statut impossible");
    },
  });

  if (workOrder.error !== null) {
    return (
      <section className="space-y-4">
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {workOrder.error.message}
        </p>
        <Link to="/ot" className="text-sm underline">
          Retour aux OT
        </Link>
      </section>
    );
  }

  const current = workOrder.data;
  const unit = units.data?.items.find((candidate) => candidate.id === current?.unitId);
  const site = sites.data?.items.find((candidate) => candidate.id === unit?.siteId);
  // `assigned` ne s'obtient pas en demandant un statut mais en affectant l'OT
  // au planning (spec 008, R4.2). Le domaine ne le propose jamais ici ; le
  // filtre le dit au typage.
  const transitions = (current === undefined ? [] : allowedTransitionsFrom(current.status)).filter(
    (status): status is RequestableWorkOrderStatus => status !== "assigned",
  );

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link to="/ot" className="text-sm text-[var(--color-muted-foreground)] hover:underline">
          ← OT
        </Link>
        <h1 data-testid="work-order-reference" className="text-2xl font-semibold tracking-tight">
          {current?.reference ?? "Chargement…"}
        </h1>
        {current !== undefined && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {WORK_ORDER_TYPE_LABELS[current.type]} ·{" "}
            <span className={WORK_ORDER_PRIORITY_CLASS[current.priority]}>
              {WORK_ORDER_PRIORITY_LABELS[current.priority]}
            </span>{" "}
            · signalé {timeAgo(current.reportedAt)}
          </p>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      {current !== undefined && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{current.summary}</CardTitle>
              <CardDescription>
                {site?.name ?? "Immeuble inconnu"} — {unit?.reference ?? "appareil inconnu"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-[var(--color-muted-foreground)]">Contact sur place : </span>
                {current.onSiteContact ?? "non renseigné"}
              </p>
              <p data-testid="report-count">
                <span className="text-[var(--color-muted-foreground)]">Signalements : </span>
                {current.reportCount}
                {current.reportCount > 1 && ` — dernier ${timeAgo(current.lastReportedAt)}`}
              </p>
            </CardContent>
          </Card>

          {/* Script de désincarcération : `null` = pas encore demandé, ce qui
              n'est pas la même chose qu'une réponse négative (spec 007, R3). */}
          {current.entrapment !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personne bloquée</CardTitle>
                <CardDescription>Questions à poser pendant l'appel.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl data-testid="entrapment-script" className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-[var(--color-muted-foreground)]">Urgence médicale :</dt>
                    <dd>{yesNo(current.entrapment.medicalEmergency)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-[var(--color-muted-foreground)]">Personnes en cabine :</dt>
                    <dd>{current.entrapment.peopleCount ?? "non demandé"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-[var(--color-muted-foreground)]">Entre deux étages :</dt>
                    <dd>{yesNo(current.entrapment.betweenFloors)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Statut : {WORK_ORDER_STATUS_LABELS[current.status]}
            </h2>
            {transitions.length === 0 ? (
              <p
                data-testid="terminal-status"
                className="text-sm text-[var(--color-muted-foreground)]"
              >
                OT clôturé. Une panne qui revient se saisit comme un nouvel OT, qui prendra la suite
                de celui-ci.
              </p>
            ) : (
              <div data-testid="status-actions" className="flex flex-wrap gap-2">
                {transitions.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={status === "cancelled" ? "outline" : "default"}
                    onClick={() => statusMutation.mutate(status)}
                    disabled={statusMutation.isPending}
                  >
                    {WORK_ORDER_STATUS_LABELS[status]}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {chain.data !== undefined &&
            (chain.data.followUpChain.length > 0 || chain.data.followedUpBy.length > 0) && (
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Chaîne</h2>
                <ul data-testid="work-order-chain" className="space-y-1 text-sm">
                  {chain.data.followUpChain.map((parent) => (
                    <li key={parent.id}>
                      Fait suite à{" "}
                      <Link
                        to="/ot/$workOrderId"
                        params={{ workOrderId: parent.id }}
                        className="font-medium hover:underline"
                      >
                        {parent.reference}
                      </Link>{" "}
                      — {parent.summary}
                    </li>
                  ))}
                  {chain.data.followedUpBy.map((child) => (
                    <li key={child.id}>
                      Suivi par{" "}
                      <Link
                        to="/ot/$workOrderId"
                        params={{ workOrderId: child.id }}
                        className="font-medium hover:underline"
                      >
                        {child.reference}
                      </Link>{" "}
                      — {child.summary}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </>
      )}
    </section>
  );
}

/** « Non demandé » n'est pas « non » : la nuance est délibérée (spec 007, R3). */
function yesNo(value: boolean | null): string {
  if (value === null) {
    return "non demandé";
  }
  return value ? "oui" : "non";
}
