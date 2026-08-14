import { createWorkOrderRequestSchema, type WorkOrderResponse } from "@asc/contracts";
import { WORK_ORDER_PRIORITIES } from "@asc/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  attachWorkOrderReport,
  createWorkOrder,
  listContactsOfSite,
  listSites,
  listUnits,
  listWorkOrders,
} from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import { SELECT_CLASS_NAME } from "@/lib/customer-type";
import {
  timeAgo,
  WORK_ORDER_PRIORITY_CLASS,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUS_LABELS,
} from "@/lib/work-order-labels";

/**
 * Saisie d'une panne entrante (spec 007).
 *
 * Le dispatcher a le téléphone à l'oreille. Deux principes commandent l'écran :
 *
 * 1. **On cherche par adresse**, jamais par référence — personne au téléphone ne
 *    dit « l'appareil ASC-0483 », on dit « le 12 rue des Lilas ».
 * 2. **On montre l'état de l'appareil avant de proposer un formulaire.** Une
 *    panne réelle est signalée cinq fois en deux heures ; sur un incident déjà
 *    connu, la meilleure saisie est celle qui n'a pas lieu.
 */
export function WorkOrderNewPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    unitId: string;
    siteId: string;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sites = useQuery({
    queryKey: ["sites", query],
    queryFn: () => listSites(token, query),
    enabled: token !== "" && selected === null,
  });

  const units = useQuery({
    queryKey: ["units"],
    queryFn: () => listUnits(token),
    enabled: token !== "",
  });

  /** Les OT encore à traiter sur cet appareil : la détection de doublon (R2.1). */
  const openWorkOrders = useQuery({
    queryKey: ["work-orders", "open", selected?.unitId],
    queryFn: () => listWorkOrders(token, { unitId: selected?.unitId, open: "true" }),
    enabled: token !== "" && selected !== null,
  });

  /** Le gardien de l'immeuble pré-remplit le contact sur place (R1.2). */
  const contacts = useQuery({
    queryKey: ["contacts", "site", selected?.siteId],
    queryFn: () => listContactsOfSite(token, selected?.siteId ?? ""),
    enabled: token !== "" && selected !== null,
  });

  const goToWorkOrder = async (workOrder: WorkOrderResponse): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["work-orders"] });
    await navigate({ to: "/ot/$workOrderId", params: { workOrderId: workOrder.id } });
  };

  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      createWorkOrder(
        token,
        createWorkOrderRequestSchema.parse({
          unitId: selected?.unitId,
          summary: form.get("summary"),
          priority: form.get("priority"),
          onSiteContact: form.get("onSiteContact"),
        }),
      ),
    onSuccess: goToWorkOrder,
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Création impossible");
    },
  });

  const attachMutation = useMutation({
    mutationFn: (workOrderId: string) => attachWorkOrderReport(token, workOrderId),
    onSuccess: goToWorkOrder,
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Rattachement impossible");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    createMutation.mutate(new FormData(event.currentTarget));
  }

  const allUnits = units.data?.items ?? [];
  const matchingSites = sites.data?.items ?? [];
  const suggestedContact = contacts.data?.items[0];
  const defaultOnSiteContact =
    suggestedContact === undefined
      ? ""
      : [suggestedContact.name, suggestedContact.role, suggestedContact.phone]
          .filter((part) => part !== null && part !== "")
          .join(" — ");
  const duplicates = openWorkOrders.data?.items ?? [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvel OT</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Cherchez l'immeuble tel que l'appelant le nomme — adresse ou nom, jamais une référence.
        </p>
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      {selected === null ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="unit-search">Immeuble ou adresse</Label>
            <Input
              id="unit-search"
              type="search"
              placeholder="12 rue des Lilas, Les Tilleuls…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>

          {matchingSites.length === 0 ? (
            <p data-testid="search-empty" className="text-sm text-[var(--color-muted-foreground)]">
              Aucun immeuble ne correspond.
            </p>
          ) : (
            <ul data-testid="unit-choices" className="space-y-3">
              {matchingSites.map((site) => {
                const siteUnits = allUnits.filter((unit) => unit.siteId === site.id);
                return (
                  <li key={site.id}>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{site.name}</CardTitle>
                        <CardDescription>
                          {site.addressLine} — {site.postalCode} {site.city}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {siteUnits.length === 0 ? (
                          <span className="text-sm text-[var(--color-muted-foreground)]">
                            Aucun appareil dans cet immeuble.
                          </span>
                        ) : (
                          siteUnits.map((unit) => (
                            <Button
                              key={unit.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelected({
                                  unitId: unit.id,
                                  siteId: site.id,
                                  label: `${site.name} — ${unit.reference}`,
                                })
                              }
                            >
                              {unit.reference}
                            </Button>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span data-testid="selected-unit" className="font-medium">
              {selected.label}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Changer d'appareil
            </Button>
          </div>

          {/* L'écart n°1 du benchmark : sur un incident déjà connu, rattacher
              plutôt que ressaisir. L'action principale bascule. */}
          {duplicates.length > 0 && (
            <Card className="border-[var(--color-destructive)]">
              <CardHeader>
                <CardTitle className="text-base">
                  Déjà signalé — {duplicates.length} OT ouvert(s) sur cet appareil
                </CardTitle>
                <CardDescription>
                  Rattachez ce signalement plutôt que d'en créer un deuxième.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul data-testid="duplicate-list" className="space-y-3">
                  {duplicates.map((workOrder) => (
                    <li
                      key={workOrder.id}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <span className="text-sm">
                        <span className="font-medium">{workOrder.reference}</span> ·{" "}
                        <span className={WORK_ORDER_PRIORITY_CLASS[workOrder.priority]}>
                          {WORK_ORDER_PRIORITY_LABELS[workOrder.priority]}
                        </span>{" "}
                        · {WORK_ORDER_STATUS_LABELS[workOrder.status]} ·{" "}
                        {timeAgo(workOrder.reportedAt)}
                        {workOrder.reportCount > 1 && ` · ${workOrder.reportCount} signalements`}
                        <br />
                        <span className="text-[var(--color-muted-foreground)]">
                          {workOrder.summary}
                        </span>
                      </span>
                      <Button
                        type="button"
                        onClick={() => attachMutation.mutate(workOrder.id)}
                        disabled={attachMutation.isPending}
                      >
                        Rattacher ce signalement
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {duplicates.length > 0 ? "Ou créer un OT distinct" : "Nouvel OT"}
              </CardTitle>
              <CardDescription>
                Type et criticité sont pré-remplis : corrigez l'exception, pas la règle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                data-testid="work-order-form"
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={handleSubmit}
              >
                <div className="space-y-2">
                  <Label htmlFor="priority">Criticité</Label>
                  <select
                    id="priority"
                    name="priority"
                    className={SELECT_CLASS_NAME}
                    defaultValue="normal"
                  >
                    {WORK_ORDER_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {WORK_ORDER_PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">Description</Label>
                  <Input
                    id="summary"
                    name="summary"
                    placeholder="Cabine bloquée au 3e"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="onSiteContact">Contact sur place</Label>
                  <Input
                    id="onSiteContact"
                    name="onSiteContact"
                    // Pré-rempli depuis le contact de l'immeuble : `key` force le
                    // remontage quand la suggestion arrive après le rendu.
                    key={defaultOnSiteContact}
                    defaultValue={defaultOnSiteContact}
                    placeholder="Gardien, code d'accès, consigne d'arrivée"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Création…" : "Créer l'OT"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      <Link
        to="/ot"
        className="inline-block text-sm text-[var(--color-muted-foreground)] hover:underline"
      >
        ← Tous les OT
      </Link>
    </section>
  );
}
