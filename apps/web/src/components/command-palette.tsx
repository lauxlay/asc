import { MIN_SEARCH_LENGTH, type SearchKind, type SearchResult } from "@asc/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { search } from "@/lib/api-client";
import { useSession } from "@/lib/auth";

/**
 * Recherche globale au clavier (spec 010).
 *
 * Écrite à la main, sans dépendance : contrairement au glisser-déposer du lot
 * L1.7, où le clavier était le vrai travail, une palette est une liste et
 * quatre touches. `cmdk` apporterait en prime un filtrage côté client dont on
 * ne veut pas — le filtrage et le classement sont au serveur.
 */

/** Libellé de la famille, affiché à droite de chaque ligne. */
const KIND_LABELS: Readonly<Record<SearchKind, string>> = {
  unit: "Appareil",
  site: "Immeuble",
  work_order: "OT",
  customer: "Client",
  contract: "Contrat",
};

/** Le temps d'arrêter de taper : on n'interroge pas à chaque frappe. */
const DEBOUNCE_MS = 150;

export function CommandPalette(): React.JSX.Element | null {
  const session = useSession();
  const token = session?.accessToken ?? "";
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  /** D'où venait le focus : on l'y remet à la fermeture (R5.4). */
  const openerRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  // Cmd+K sur macOS, Ctrl+K ailleurs. C'est le **seul** raccourci global :
  // hors palette, on ne vole aucune touche au navigateur (R5.7).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openerRef.current = document.activeElement as HTMLElement | null;
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => search(token, debounced),
    enabled: open && token !== "" && debounced.trim().length >= MIN_SEARCH_LENGTH,
    placeholderData: keepPreviousData,
  });

  const results = debounced.trim().length >= MIN_SEARCH_LENGTH ? (data?.items ?? []) : [];
  // Le premier résultat est présélectionné : taper puis Entrée suffit (R5.5).
  const active = results[Math.min(highlighted, results.length - 1)];

  function close(): void {
    setOpen(false);
    setQuery("");
    setDebounced("");
    setHighlighted(0);
    openerRef.current?.focus();
  }

  function openResult(result: SearchResult): void {
    close();
    void navigate(destinationOf(result));
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (active !== undefined) {
        openResult(active);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) {
        return;
      }
      // La liste boucle : sur vingt lignes au plus, faire le tour est plus
      // rapide que de remonter (R5.6).
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted((current) => (current + step + results.length) % results.length);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24">
      {/* Le fond est un vrai bouton : il ferme au clic **et** annonce ce qu'il
          fait. Échap fait le même travail sans quitter le clavier. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fermer la recherche"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
        data-testid="command-palette"
        className="relative w-full max-w-xl overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] shadow-lg"
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
          placeholder="Rechercher un appareil, un immeuble, un client, un OT…"
          aria-label="Rechercher"
          aria-controls={listId}
          aria-activedescendant={active === undefined ? undefined : optionId(listId, active)}
          className="w-full border-b border-[var(--color-border)] bg-transparent px-4 py-3 text-sm outline-none"
        />

        {results.length === 0 ? (
          <p
            data-testid="palette-empty"
            className="px-4 py-6 text-sm text-[var(--color-muted-foreground)]"
          >
            {query.trim().length < MIN_SEARCH_LENGTH
              ? `Tapez au moins ${MIN_SEARCH_LENGTH} caractères.`
              : "Aucun résultat."}
          </p>
        ) : (
          <div id={listId} role="listbox" aria-label="Résultats" data-testid="palette-results">
            {results.map((result, index) => (
              // `tabIndex={-1}` : la sélection se pilote par
              // `aria-activedescendant` depuis le champ, jamais par le focus —
              // sans quoi chaque flèche déplacerait le curseur de saisie.
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                tabIndex={-1}
                id={optionId(listId, result)}
                role="option"
                aria-selected={result === active}
                data-testid="palette-result"
                className={`flex w-full items-baseline justify-between gap-4 px-4 py-2 text-left text-sm ${
                  result === active ? "bg-[var(--color-muted)]" : ""
                }`}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => openResult(result)}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{result.label}</span>
                  <span className="block truncate text-[var(--color-muted-foreground)]">
                    {result.sublabel}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
                  {KIND_LABELS[result.kind]}
                </span>
              </button>
            ))}
          </div>
        )}

        {data?.truncated === true && results.length > 0 && (
          <p className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted-foreground)]">
            Trop de correspondances : précisez votre recherche.
          </p>
        )}
      </div>
    </div>
  );
}

function optionId(listId: string, result: SearchResult): string {
  return `${listId}-${result.kind}-${result.id}`;
}

/**
 * Où mène un résultat.
 *
 * `targetId` est **la page à ouvrir**, pas l'entité trouvée : un appareil mène
 * à la fiche de son immeuble, et c'est le serveur qui le dit (spec 010, R4).
 */
function destinationOf(result: SearchResult): { to: string; params?: Record<string, string> } {
  switch (result.kind) {
    case "unit":
    case "site":
      return { to: "/sites/$siteId", params: { siteId: result.targetId } };
    case "customer":
      return { to: "/clients/$customerId", params: { customerId: result.targetId } };
    case "work_order":
      return { to: "/ot/$workOrderId", params: { workOrderId: result.targetId } };
    case "contract":
      return { to: "/contrats/$contractId", params: { contractId: result.targetId } };
  }
}
