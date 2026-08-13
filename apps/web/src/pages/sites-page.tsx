import { createSiteRequestSchema } from "@asc/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSite, listSites } from "@/lib/api-client";
import { useSession } from "@/lib/auth";

/**
 * Écran de parc : les immeubles, avec recherche par adresse (spec 002).
 *
 * Le dispatcher raisonne par adresse — le gardien qui appelle dit « le 12 rue
 * des Lilas », jamais un code interne. La recherche interroge l'API à chaque
 * frappe ; `keepPreviousData` garde la liste précédente affichée pendant
 * l'aller-retour, sinon elle clignoterait à chaque lettre.
 */
export function SitesPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["sites", query],
    queryFn: () => listSites(token, query),
    enabled: token !== "",
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      createSite(
        token,
        createSiteRequestSchema.parse({
          name: form.get("name"),
          addressLine: form.get("addressLine"),
          postalCode: form.get("postalCode"),
          city: form.get("city"),
        }),
      ),
    onSuccess: async () => {
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
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
          <h1 className="text-2xl font-semibold tracking-tight">Parc</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Les immeubles suivis par votre société.
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
          {creating ? "Annuler" : "Nouveau site"}
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveau site</CardTitle>
            <CardDescription>L'adresse sert à retrouver l'immeuble.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nom de l'immeuble</Label>
                <Input id="name" name="name" required autoFocus />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="addressLine">Adresse</Label>
                <Input id="addressLine" name="addressLine" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" name="postalCode" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" required />
              </div>
              {formError !== null && (
                <p role="alert" className="text-sm text-[var(--color-destructive)] sm:col-span-2">
                  {formError}
                </p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Création…" : "Créer le site"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <Label htmlFor="site-search">Rechercher une adresse</Label>
        <Input
          id="site-search"
          type="search"
          placeholder="12 rue des Lilas, Lyon…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {isPending && <p className="text-sm text-[var(--color-muted-foreground)]">Chargement…</p>}

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error.message}
        </p>
      )}

      {data !== undefined &&
        (data.items.length === 0 ? (
          <p data-testid="sites-empty" className="text-sm text-[var(--color-muted-foreground)]">
            {query === "" ? "Aucun site pour le moment." : "Aucun site ne correspond."}
          </p>
        ) : (
          <ul data-testid="sites-list" className="grid gap-3 sm:grid-cols-2">
            {data.items.map((site) => (
              <li key={site.id}>
                <Link to="/sites/$siteId" params={{ siteId: site.id }} className="block">
                  <Card className="h-full transition-colors hover:bg-[var(--color-accent)]">
                    <CardHeader>
                      <CardTitle className="text-base">{site.name}</CardTitle>
                      <CardDescription>
                        {site.addressLine} — {site.postalCode} {site.city}
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
