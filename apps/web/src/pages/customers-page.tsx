import { createCustomerRequestSchema } from "@asc/contracts";
import { CUSTOMER_TYPES } from "@asc/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomer, listCustomers } from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import { CUSTOMER_TYPE_LABELS, SELECT_CLASS_NAME } from "@/lib/customer-type";

/**
 * Portefeuille client : syndics, copropriétés et particuliers (spec 003).
 *
 * Pas de recherche ici, contrairement au parc : un portefeuille se compte en
 * dizaines, un parc en centaines. La recherche globale de L1.9 couvrira le
 * besoin le jour où il existe.
 */
export function CustomersPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ["customers"],
    queryFn: () => listCustomers(token),
    enabled: token !== "",
  });

  const createMutation = useMutation({
    mutationFn: (form: FormData) =>
      createCustomer(
        token,
        createCustomerRequestSchema.parse({
          name: form.get("name"),
          type: form.get("type"),
        }),
      ),
    onSuccess: async () => {
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
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
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Les donneurs d'ordre de votre société.
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
          {creating ? "Annuler" : "Nouveau client"}
        </Button>
      </div>

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveau client</CardTitle>
            <CardDescription>Un syndic, une copropriété ou un particulier.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Nom du client</Label>
                <Input id="name" name="name" required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type de client</Label>
                <select id="type" name="type" className={SELECT_CLASS_NAME} defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {CUSTOMER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CUSTOMER_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              {formError !== null && (
                <p role="alert" className="text-sm text-[var(--color-destructive)] sm:col-span-2">
                  {formError}
                </p>
              )}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Création…" : "Créer le client"}
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
          <p data-testid="customers-empty" className="text-sm text-[var(--color-muted-foreground)]">
            Aucun client pour le moment.
          </p>
        ) : (
          <ul data-testid="customers-list" className="grid gap-3 sm:grid-cols-2">
            {data.items.map((customer) => (
              <li key={customer.id}>
                <Link
                  to="/clients/$customerId"
                  params={{ customerId: customer.id }}
                  className="block"
                >
                  <Card className="h-full transition-colors hover:bg-[var(--color-accent)]">
                    <CardHeader>
                      <CardTitle className="text-base">{customer.name}</CardTitle>
                      <CardDescription>{CUSTOMER_TYPE_LABELS[customer.type]}</CardDescription>
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
