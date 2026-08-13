import { createContractRequestSchema } from "@asc/contracts";
import { CONTRACT_TYPES } from "@asc/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createContract, listContracts } from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import { CONTRACT_TYPE_LABELS } from "@/lib/contract-labels";
import { SELECT_CLASS_NAME } from "@/lib/customer-type";

/**
 * Contrats d'entretien (spec 005).
 *
 * Le contrat est obligatoire par la loi et déclenche tout le reste : sans lui,
 * aucune visite n'est due, donc aucune échéance à suivre.
 */
export function ContractsPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["contracts"],
    queryFn: () => listContracts(token),
    enabled: token !== "",
  });

  const createMutation = useMutation({
    mutationFn: (form: FormData) => {
      const endsOn = String(form.get("endsOn") ?? "");
      return createContract(
        token,
        createContractRequestSchema.parse({
          reference: form.get("reference"),
          type: form.get("type"),
          startsOn: form.get("startsOn"),
          endsOn: endsOn === "" ? null : endsOn,
          unitIds: [],
        }),
      );
    },
    onSuccess: async () => {
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (cause: unknown) => {
      setFormError(cause instanceof Error ? cause.message : "Création impossible");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);
    createMutation.mutate(new FormData(event.currentTarget));
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contrats</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Contrats d'entretien et appareils couverts.
          </p>
        </div>
        <Button
          type="button"
          variant={creating ? "outline" : "default"}
          onClick={() => {
            setFormError(null);
            setCreating((open) => !open);
          }}
        >
          {creating ? "Annuler" : "Nouveau contrat"}
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveau contrat</CardTitle>
            <CardDescription>
              Durée minimale d'un an (loi SAE 2003). Sans terme, le contrat court par tacite
              reconduction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="reference">Numéro de contrat</Label>
                <Input
                  id="reference"
                  name="reference"
                  placeholder="CT-2026-014"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type de contrat</Label>
                <select id="type" name="type" className={SELECT_CLASS_NAME} defaultValue="minimal">
                  {CONTRACT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CONTRACT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startsOn">Prise d'effet</Label>
                <Input id="startsOn" name="startsOn" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsOn">Terme (facultatif)</Label>
                <Input id="endsOn" name="endsOn" type="date" />
              </div>
              {formError !== null && (
                <p role="alert" className="text-sm text-[var(--color-destructive)] sm:col-span-2">
                  {formError}
                </p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Création…" : "Créer le contrat"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isPending && <p className="text-sm text-[var(--color-muted-foreground)]">Chargement…</p>}

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error.message}
        </p>
      )}

      {data !== undefined &&
        (data.items.length === 0 ? (
          <p data-testid="contracts-empty" className="text-sm text-[var(--color-muted-foreground)]">
            Aucun contrat pour le moment.
          </p>
        ) : (
          <ul data-testid="contracts-list" className="grid gap-3 sm:grid-cols-2">
            {data.items.map((contract) => (
              <li key={contract.id}>
                <Link
                  to="/contrats/$contractId"
                  params={{ contractId: contract.id }}
                  className="block"
                >
                  <Card className="h-full transition-colors hover:bg-[var(--color-accent)]">
                    <CardHeader>
                      <CardTitle className="text-base">{contract.reference}</CardTitle>
                      <CardDescription>
                        {CONTRACT_TYPE_LABELS[contract.type]} · {contract.unitIds.length}{" "}
                        appareil(s) · depuis le {contract.startsOn}
                        {contract.endsOn === null
                          ? " (tacite reconduction)"
                          : ` au ${contract.endsOn}`}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
