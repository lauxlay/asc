import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listUnits } from "@/lib/api-client";
import { useSession } from "@/lib/auth";

/**
 * Écran d'atterrissage du squelette : le parc en lecture seule.
 *
 * Il prouve la chaîne complète — session, jeton porté par le client HTTP,
 * TanStack Query, réponse validée par les contrats. Le lot **L1.1** le
 * remplacera par le vrai écran de parc (CRUD sites et appareils).
 */
export function UnitsPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";

  const { data, isPending, error } = useQuery({
    queryKey: ["units"],
    queryFn: () => listUnits(token),
    enabled: token !== "",
  });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Parc</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Appareils rattachés à votre société.
        </p>
      </div>

      {isPending && <p className="text-sm text-[var(--color-muted-foreground)]">Chargement…</p>}

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error.message}
        </p>
      )}

      {data !== undefined &&
        (data.items.length === 0 ? (
          <p data-testid="units-empty" className="text-sm text-[var(--color-muted-foreground)]">
            Aucun appareil pour le moment.
          </p>
        ) : (
          <ul data-testid="units-list" className="grid gap-3 sm:grid-cols-2">
            {data.items.map((unit) => (
              <li key={unit.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{unit.siteId}</CardTitle>
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
