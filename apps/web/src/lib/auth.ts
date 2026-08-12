import type { AuthenticatedUser } from "@asc/contracts";
import { useSyncExternalStore } from "react";
import * as api from "./api-client";

/**
 * Session du back-office, tenue dans un petit magasin externe plutôt que dans
 * un état React.
 *
 * Raison : les gardes de route (`beforeLoad`) lisent la session **pendant** la
 * navigation, avant tout rendu. Un état React ne serait à jour qu'au rendu
 * suivant, et une redirection déciderait sur une session périmée — connecté
 * mais renvoyé vers la page de connexion.
 *
 * Le jeton est conservé dans `localStorage` : l'application est installée
 * (ADR-003) et le dispatcher y passe la journée, il ne doit pas se reconnecter
 * à chaque rechargement. Contrepartie assumée en Phase 0 — un XSS donnerait
 * accès au jeton ; un cookie httpOnly viendra avec le durcissement sécurité
 * (`docs/03-application/06-securite-rgpd.md`).
 */

const STORAGE_KEY = "asc.session";

export interface Session {
  readonly accessToken: string;
  readonly user: AuthenticatedUser;
}

function readStoredSession(): Session | null {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (raw == null) {
    return null;
  }
  try {
    return JSON.parse(raw) as Session;
  } catch {
    // Entrée corrompue : on repart d'une session vide plutôt que de planter.
    globalThis.localStorage?.removeItem(STORAGE_KEY);
    return null;
  }
}

let current: Session | null = readStoredSession();
const listeners = new Set<() => void>();

function publish(next: Session | null): void {
  current = next;
  if (next === null) {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } else {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Lecture synchrone : utilisable dans les gardes de route comme dans React. */
export function getSession(): Session | null {
  return current;
}

export async function signIn(email: string, password: string): Promise<void> {
  const response = await api.login({ email, password });
  publish({ accessToken: response.accessToken, user: response.user });
}

export function signOut(): void {
  publish(null);
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, getSession);
}
