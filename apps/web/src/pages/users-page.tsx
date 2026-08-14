import { MIN_PASSWORD_LENGTH, type UserResponse } from "@asc/contracts";
import { USER_ROLES, type UserRole } from "@asc/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUser, listUsers, updateUser } from "@/lib/api-client";
import { useSession } from "@/lib/auth";

/**
 * Gestion minimale des utilisateurs (spec 008, R1).
 *
 * Aucun lot du découpage ne créait d'utilisateurs : sans cet écran, le planning
 * n'aurait qu'une ligne et aucun technicien ne pourrait se connecter au mobile.
 *
 * Pas de suppression : un utilisateur est référencé par des OT passés. On
 * désactive, et l'historique reste lisible.
 */

const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  admin: "Administrateur",
  dispatcher: "Dispatcher",
  technician: "Technicien",
  accountant: "Comptable",
};

export function UsersPage(): React.JSX.Element {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("technician");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(token),
    enabled: token !== "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const create = useMutation({
    mutationFn: () => createUser(token, { email, name, role, password }),
    onSuccess: () => {
      setEmail("");
      setName("");
      setPassword("");
      setError(null);
      void invalidate();
      // Le planning gagne ou perd une ligne : sa copie en cache est périmée.
      void queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateUser(token, id, { active }),
    onSuccess: () => {
      setError(null);
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ["planning"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const users = data?.items ?? [];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Les techniciens actifs forment les lignes du planning.
        </p>
      </header>

      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="user-name">Nom</Label>
          <Input
            id="user-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-role">Rôle</Label>
          <select
            id="user-role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className="h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
          >
            {USER_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-password">Mot de passe initial</Label>
          <Input
            id="user-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {MIN_PASSWORD_LENGTH} caractères minimum, à transmettre à la personne de vive voix.
          </p>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            Créer l'utilisateur
          </Button>
        </div>
      </form>

      {error !== null && (
        <p role="alert" className="text-sm text-[var(--color-destructive)]">
          {error}
        </p>
      )}

      {isPending ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Chargement…</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="p-2 font-medium">Nom</th>
              <th className="p-2 font-medium">Email</th>
              <th className="p-2 font-medium">Rôle</th>
              <th className="p-2 font-medium">État</th>
              <th className="p-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === session?.user.id}
                onToggle={() => setActive.mutate({ id: user.id, active: !user.active })}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function UserRow({
  user,
  isSelf,
  onToggle,
}: {
  user: UserResponse;
  isSelf: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <tr
      data-testid="user-row"
      data-email={user.email}
      className="border-b border-[var(--color-border)]"
    >
      <td className="p-2">{user.name}</td>
      <td className="p-2 text-[var(--color-muted-foreground)]">{user.email}</td>
      <td className="p-2">{ROLE_LABELS[user.role]}</td>
      <td className="p-2">{user.active ? "Actif" : "Désactivé"}</td>
      <td className="p-2 text-right">
        {/* On ne peut pas se désactiver soi-même : personne ne rouvrirait le
            compte (R1.8). Le bouton disparaît plutôt que d'échouer. */}
        {isSelf ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">Vous</span>
        ) : (
          <Button variant="outline" onClick={onToggle}>
            {user.active ? "Désactiver" : "Réactiver"}
          </Button>
        )}
      </td>
    </tr>
  );
}
