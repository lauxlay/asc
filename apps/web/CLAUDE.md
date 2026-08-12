# apps/web — règles locales

Back-office React 19 + Vite, **PWA installable** (ADR-003). Consomme l'API via `@asc/contracts`.

## Non négociable

- **Ne modifie jamais `packages/contracts`** : front consomme, back produit (`docs/03-application/08-organisation-multi-agents.md`). Contrat manquant → ticket vers back, pas de contournement.
- **Aucune logique métier ici** : les règles vivent dans `@asc/domain`. Cette app affiche et saisit.
- **shadcn/ui + Tailwind par défaut, zéro composant custom** tant qu'un défaut fait le travail. Thème neutre unique dans `src/index.css`.
- **Pas d'écriture offline** (ADR-003) : la saisie exige le réseau, l'offline d'écriture reste l'exclusivité du mobile technicien. Lecture dégradée uniquement, signalée par `OfflineBanner`.
- **Tout parcours ajouté vient avec son e2e Playwright**, ajouté à la suite cumulative de `e2e/`. Un test supprimé ou skippé est bloquant en review.

## Particularités techniques

- **La session vit dans un magasin externe** (`src/lib/auth.ts`), pas dans un état React : les gardes `beforeLoad` s'exécutent avant le rendu et liraient sinon une session en retard d'un tour.
- **Appels API en même origine sous `/api`** : proxy Vite en dev et en preview, reverse proxy en production (ADR-002). Jamais d'URL absolue dans le code.
- **Réponses parsées** avec les schémas de `@asc/contracts` : une API qui dérive est détectée au client, pas trois écrans plus loin.
- Icônes du manifeste générées par `pnpm --filter @asc/web icons` (script sans dépendance).

## Commandes

```bash
pnpm --filter @asc/web dev       # serveur de dev sur 5173, API proxyée depuis 3000
pnpm --filter @asc/web e2e       # suite Playwright (build API et web requis)
```
