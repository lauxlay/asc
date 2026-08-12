import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";

/**
 * Invite de mise à jour (ADR-003) : jamais de version figée chez un client.
 *
 * Le service worker signale qu'une nouvelle version est prête ; on propose de
 * recharger plutôt que de l'imposer — le dispatcher peut être en pleine saisie.
 */
export function PwaUpdatePrompt(): React.JSX.Element | null {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="pwa-update-prompt"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm shadow-lg"
    >
      <span>Une nouvelle version est disponible.</span>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Recharger
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Plus tard
      </Button>
    </div>
  );
}
