import type { CustomerType } from "@asc/domain";

/**
 * Libellés français des types de client.
 *
 * Le code est en anglais (`docs/03-application/03-modele-donnees.md`), l'écran
 * est en français : la traduction vit ici, à la frontière de l'affichage, et
 * nulle part ailleurs.
 */
export const CUSTOMER_TYPE_LABELS: Readonly<Record<CustomerType, string>> = {
  managing_agent: "Syndic",
  condominium: "Copropriété",
  individual: "Particulier",
};

/** Classes du `<select>` natif, alignées sur le champ shadcn/ui `Input`. */
export const SELECT_CLASS_NAME =
  "flex h-9 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50";
