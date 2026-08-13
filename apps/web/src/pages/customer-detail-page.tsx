import { createContactRequestSchema } from "@asc/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createContact,
  getCustomer,
  listContactsOfCustomer,
  listSites,
  listSitesOfCustomer,
  setSiteCustomer,
} from "@/lib/api-client";
import { useSession } from "@/lib/auth";
import { CUSTOMER_TYPE_LABELS, SELECT_CLASS_NAME } from "@/lib/customer-type";

/**
 * Fiche client : ses immeubles et ses interlocuteurs (spec 003).
 *
 * Le rattachement se fait depuis le client, pas depuis l'immeuble : le
 * dispatcher qui saisit un nouveau syndic enchaîne ses immeubles d'un coup.
 */
export function CustomerDetailPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const { customerId } = useParams({ from: "/authenticated/clients/$customerId" });
  const queryClient = useQueryClient();

  const [addingContact, setAddingContact] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customer = useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => getCustomer(token, customerId),
    enabled: token !== "",
  });

  const sites = useQuery({
    queryKey: ["sites", "of-customer", customerId],
    queryFn: () => listSitesOfCustomer(token, customerId),
    enabled: token !== "",
  });

  /** Tout le parc : sert à proposer les immeubles encore sans client. */
  const allSites = useQuery({
    queryKey: ["sites", ""],
    queryFn: () => listSites(token),
    enabled: token !== "",
  });

  const contacts = useQuery({
    queryKey: ["contacts", customerId],
    queryFn: () => listContactsOfCustomer(token, customerId),
    enabled: token !== "",
  });

  async function refreshSites(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["sites"] });
  }

  const attachMutation = useMutation({
    mutationFn: (siteId: string) => setSiteCustomer(token, siteId, customerId),
    onSuccess: refreshSites,
  });

  const detachMutation = useMutation({
    mutationFn: (siteId: string) => setSiteCustomer(token, siteId, null),
    onSuccess: refreshSites,
  });

  const addContactMutation = useMutation({
    mutationFn: (form: FormData) => {
      const siteId = String(form.get("siteId") ?? "");
      return createContact(
        token,
        createContactRequestSchema.parse({
          customerId,
          siteId: siteId === "" ? null : siteId,
          name: form.get("name"),
          role: form.get("role"),
          email: form.get("email"),
          phone: form.get("phone"),
        }),
      );
    },
    onSuccess: async () => {
      setAddingContact(false);
      await queryClient.invalidateQueries({ queryKey: ["contacts", customerId] });
    },
    onError: (cause: unknown) => {
      setFormError(cause instanceof Error ? cause.message : "Ajout impossible");
    },
  });

  function handleContactSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(null);
    addContactMutation.mutate(new FormData(event.currentTarget));
  }

  if (customer.error !== null) {
    return (
      <section className="space-y-4">
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {customer.error.message}
        </p>
        <Link to="/clients" className="text-sm underline">
          Retour aux clients
        </Link>
      </section>
    );
  }

  const attachable = (allSites.data?.items ?? []).filter((site) => site.customerId === null);
  const attachedSites = sites.data?.items ?? [];

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link
          to="/clients"
          className="text-sm text-[var(--color-muted-foreground)] hover:underline"
        >
          ← Clients
        </Link>
        <h1 data-testid="customer-name" className="text-2xl font-semibold tracking-tight">
          {customer.data?.name ?? "Chargement…"}
        </h1>
        {customer.data !== undefined && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {CUSTOMER_TYPE_LABELS[customer.data.type]}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Immeubles rattachés</h2>

        {attachable.length > 0 && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const siteId = String(new FormData(event.currentTarget).get("siteId") ?? "");
              if (siteId !== "") {
                attachMutation.mutate(siteId);
                event.currentTarget.reset();
              }
            }}
          >
            <div className="min-w-64 flex-1 space-y-2">
              <Label htmlFor="attach-site">Rattacher un immeuble</Label>
              <select id="attach-site" name="siteId" className={SELECT_CLASS_NAME} defaultValue="">
                <option value="" disabled>
                  Choisir un immeuble…
                </option>
                {attachable.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} — {site.addressLine}, {site.city}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={attachMutation.isPending}>
              {attachMutation.isPending ? "Rattachement…" : "Rattacher"}
            </Button>
          </form>
        )}

        {attachedSites.length === 0 ? (
          <p
            data-testid="customer-sites-empty"
            className="text-sm text-[var(--color-muted-foreground)]"
          >
            Aucun immeuble rattaché.
          </p>
        ) : (
          <ul data-testid="customer-sites-list" className="grid gap-3 sm:grid-cols-2">
            {attachedSites.map((site) => (
              <li key={site.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link
                        to="/sites/$siteId"
                        params={{ siteId: site.id }}
                        className="hover:underline"
                      >
                        {site.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {site.addressLine} — {site.postalCode} {site.city}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => detachMutation.mutate(site.id)}
                      disabled={detachMutation.isPending}
                    >
                      Détacher
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Contacts</h2>
          <Button
            type="button"
            variant={addingContact ? "outline" : "default"}
            onClick={() => {
              setFormError(null);
              setAddingContact((open) => !open);
            }}
          >
            {addingContact ? "Annuler" : "Ajouter un contact"}
          </Button>
        </div>

        {addingContact && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nouveau contact</CardTitle>
              <CardDescription>
                Rattachez-le à un immeuble pour déclarer un gardien.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleContactSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Nom du contact</Label>
                  <Input id="contact-name" name="name" required autoFocus />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-role">Rôle</Label>
                  <Input id="contact-role" name="role" placeholder="Gardien" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input id="contact-email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Téléphone</Label>
                  <Input id="contact-phone" name="phone" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contact-site">Immeuble concerné</Label>
                  <select
                    id="contact-site"
                    name="siteId"
                    className={SELECT_CLASS_NAME}
                    defaultValue=""
                  >
                    <option value="">Tous les immeubles du client</option>
                    {attachedSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
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
                  <Button type="submit" disabled={addContactMutation.isPending}>
                    {addContactMutation.isPending ? "Ajout…" : "Ajouter le contact"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {contacts.data !== undefined &&
          (contacts.data.items.length === 0 ? (
            <p
              data-testid="contacts-empty"
              className="text-sm text-[var(--color-muted-foreground)]"
            >
              Aucun contact pour ce client.
            </p>
          ) : (
            <ul data-testid="contacts-list" className="grid gap-3 sm:grid-cols-2">
              {contacts.data.items.map((contact) => (
                <li key={contact.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{contact.name}</CardTitle>
                      <CardDescription>{contact.role}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-[var(--color-muted-foreground)]">
                      <p>{contact.email ?? "Sans email"}</p>
                      <p>{contact.phone ?? "Sans téléphone"}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
