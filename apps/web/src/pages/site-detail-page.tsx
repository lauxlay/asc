import { createUnitRequestSchema } from "@asc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUnit, getSite, listUnits } from "@/lib/api-client";
import { useSession } from "@/lib/auth";

/**
 * Fiche d'un immeuble et de ses appareils (spec 002).
 *
 * Les dates du formulaire passent par `createUnitRequestSchema` : la même
 * règle valide ici et sur le serveur, et une saisie douteuse est signalée
 * avant l'aller-retour réseau.
 */
export function SiteDetailPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const { siteId } = useParams({ from: "/authenticated/sites/$siteId" });
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const site = useQuery({
    queryKey: ["sites", siteId],
    queryFn: () => getSite(token, siteId),
    enabled: token !== "",
  });

  const units = useQuery({
    queryKey: ["units", siteId],
    queryFn: () => listUnits(token, siteId),
    enabled: token !== "",
  });

  const addMutation = useMutation({
    mutationFn: (form: FormData) => {
      const commissionedOn = String(form.get("commissionedOn") ?? "");
      return createUnit(
        token,
        createUnitRequestSchema.parse({
          siteId,
          reference: form.get("reference"),
          commissionedOn: commissionedOn === "" ? null : commissionedOn,
        }),
      );
    },
    onSuccess: async () => {
      setAdding(false);
      await queryClient.invalidateQueries({ queryKey: ["units", siteId] });
    },
    onError: (cause: unknown) => {
      setFormError(cause instanceof Error ? cause.message : "Ajout impossible");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);
    addMutation.mutate(new FormData(event.currentTarget));
  }

  if (site.error !== null) {
    return (
      <section className="space-y-4">
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {site.error.message}
        </p>
        <Link to="/" className="text-sm underline">
          Retour au parc
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link to="/" className="text-sm text-[var(--color-muted-foreground)] hover:underline">
          ← Parc
        </Link>
        <h1 data-testid="site-name" className="text-2xl font-semibold tracking-tight">
          {site.data?.name ?? "Chargement…"}
        </h1>
        {site.data !== undefined && (
          <p data-testid="site-address" className="text-sm text-[var(--color-muted-foreground)]">
            {site.data.addressLine} — {site.data.postalCode} {site.data.city}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Appareils</h2>
        <Button
          type="button"
          variant={adding ? "outline" : "default"}
          onClick={() => {
            setFormError(null);
            setAdding((open) => !open);
          }}
        >
          {adding ? "Annuler" : "Ajouter un appareil"}
        </Button>
      </div>

      {adding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvel appareil</CardTitle>
            <CardDescription>Le repère distingue les appareils d'un immeuble.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="reference">Repère</Label>
                <Input
                  id="reference"
                  name="reference"
                  placeholder="Ascenseur A"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionedOn">Mise en service</Label>
                <Input id="commissionedOn" name="commissionedOn" type="date" />
              </div>
              {formError !== null && (
                <p role="alert" className="text-sm text-[var(--color-destructive)] sm:col-span-2">
                  {formError}
                </p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Ajout…" : "Ajouter l'appareil"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {units.isPending && (
        <p className="text-sm text-[var(--color-muted-foreground)]">Chargement…</p>
      )}

      {units.error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {units.error.message}
        </p>
      )}

      {units.data !== undefined &&
        (units.data.items.length === 0 ? (
          <p data-testid="units-empty" className="text-sm text-[var(--color-muted-foreground)]">
            Aucun appareil dans cet immeuble.
          </p>
        ) : (
          <ul data-testid="units-list" className="grid gap-3 sm:grid-cols-2">
            {units.data.items.map((unit) => (
              <li key={unit.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{unit.reference}</CardTitle>
                    <CardDescription>Appareil {unit.id.slice(0, 8)}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-[var(--color-muted-foreground)]">
                    <p>Mise en service : {unit.commissionedOn ?? "inconnue"}</p>
                    <p>Dernier quinquennal : {unit.lastStatutoryInspectionOn ?? "inconnu"}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
