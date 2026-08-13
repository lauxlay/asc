import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  getContract,
  listContractDeadlines,
  listSites,
  listUnits,
  setContractUnits,
} from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import {
  CONTRACT_TYPE_LABELS,
  DEADLINE_KIND_LABELS,
  DEADLINE_STATUS_CLASS,
  DEADLINE_STATUS_LABELS,
} from "@/lib/contract-labels";
import { SELECT_CLASS_NAME } from "@/lib/customer-type";

/**
 * Fiche contrat : ses appareils et les échéances qu'il génère (spec 005).
 *
 * C'est le premier écran où le moteur d'échéances du lot L0.2 devient visible.
 */
export function ContractDetailPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const { contractId } = useParams({ from: "/authenticated/contrats/$contractId" });
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);

  const contract = useQuery({
    queryKey: ["contracts", contractId],
    queryFn: () => getContract(token, contractId),
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

  const deadlines = useQuery({
    queryKey: ["contracts", contractId, "deadlines"],
    queryFn: () => listContractDeadlines(token, contractId),
    enabled: token !== "",
  });

  const linkMutation = useMutation({
    mutationFn: (unitIds: readonly string[]) => setContractUnits(token, contractId, unitIds),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Modification impossible");
    },
  });

  if (contract.error !== null) {
    return (
      <section className="space-y-4">
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {contract.error.message}
        </p>
        <Link to="/contrats" className="text-sm underline">
          Retour aux contrats
        </Link>
      </section>
    );
  }

  const linkedIds = contract.data?.unitIds ?? [];
  const allUnits = units.data?.items ?? [];
  const siteNameById = new Map((sites.data?.items ?? []).map((site) => [site.id, site.name]));

  const linkedUnits = allUnits.filter((unit) => linkedIds.includes(unit.id));
  const linkableUnits = allUnits.filter((unit) => !linkedIds.includes(unit.id));

  const labelOf = (unit: (typeof allUnits)[number]): string =>
    `${siteNameById.get(unit.siteId) ?? "Immeuble inconnu"} — ${unit.reference}`;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link
          to="/contrats"
          className="text-sm text-[var(--color-muted-foreground)] hover:underline"
        >
          ← Contrats
        </Link>
        <h1 data-testid="contract-reference" className="text-2xl font-semibold tracking-tight">
          {contract.data?.reference ?? "Chargement…"}
        </h1>
        {contract.data !== undefined && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Contrat {CONTRACT_TYPE_LABELS[contract.data.type]} · depuis le {contract.data.startsOn}
            {contract.data.endsOn === null
              ? " · tacite reconduction"
              : ` · jusqu'au ${contract.data.endsOn}`}
          </p>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Appareils couverts</h2>

        {linkableUnits.length > 0 && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const unitId = String(new FormData(event.currentTarget).get("unitId") ?? "");
              if (unitId !== "") {
                linkMutation.mutate([...linkedIds, unitId]);
                event.currentTarget.reset();
              }
            }}
          >
            <div className="min-w-64 flex-1 space-y-2">
              <Label htmlFor="link-unit">Lier un appareil</Label>
              <select id="link-unit" name="unitId" className={SELECT_CLASS_NAME} defaultValue="">
                <option value="" disabled>
                  Choisir un appareil…
                </option>
                {linkableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {labelOf(unit)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={linkMutation.isPending}>
              {linkMutation.isPending ? "Liaison…" : "Lier"}
            </Button>
          </form>
        )}

        {linkedUnits.length === 0 ? (
          <p
            data-testid="contract-units-empty"
            className="text-sm text-[var(--color-muted-foreground)]"
          >
            Aucun appareil couvert.
          </p>
        ) : (
          <ul data-testid="contract-units-list" className="grid gap-3 sm:grid-cols-2">
            {linkedUnits.map((unit) => (
              <li key={unit.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">{unit.reference}</CardTitle>
                    <CardDescription>
                      {siteNameById.get(unit.siteId) ?? "Immeuble inconnu"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => linkMutation.mutate(linkedIds.filter((id) => id !== unit.id))}
                      disabled={linkMutation.isPending}
                    >
                      Retirer
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Échéances générées</h2>
        {deadlines.data !== undefined && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Calculées au {deadlines.data.evaluatedOn}, jamais stockées.
          </p>
        )}

        {deadlines.data !== undefined &&
          (deadlines.data.items.length === 0 ? (
            <p
              data-testid="deadlines-empty"
              className="text-sm text-[var(--color-muted-foreground)]"
            >
              Aucune échéance : liez des appareils au contrat.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Appareil</th>
                    <th className="py-1 pr-4 font-medium">Immeuble</th>
                    <th className="py-1 pr-4 font-medium">Échéance</th>
                    <th className="py-1 pr-4 font-medium">Due le</th>
                    <th className="py-1 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody data-testid="deadlines-list">
                  {deadlines.data.items.map((deadline) => (
                    <tr
                      key={`${deadline.unitId}-${deadline.kind}`}
                      className="border-t border-[var(--color-border)]"
                    >
                      <td className="py-1 pr-4">{deadline.unitReference}</td>
                      <td className="py-1 pr-4">{deadline.siteName}</td>
                      <td className="py-1 pr-4">{DEADLINE_KIND_LABELS[deadline.kind]}</td>
                      <td className="py-1 pr-4">{deadline.dueOn}</td>
                      <td className={`py-1 ${DEADLINE_STATUS_CLASS[deadline.status] ?? ""}`}>
                        {DEADLINE_STATUS_LABELS[deadline.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </section>
  );
}
