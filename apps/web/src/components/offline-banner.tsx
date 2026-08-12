import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Bandeau « hors ligne — lecture seule » (ADR-003).
 *
 * Le back-office n'écrit jamais hors ligne : l'offline d'écriture reste
 * l'exclusivité du mobile technicien. On prévient donc discrètement que les
 * données affichées peuvent dater et que la saisie va échouer.
 */
export function OfflineBanner(): React.JSX.Element | null {
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine ?? true);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    globalThis.addEventListener("online", goOnline);
    globalThis.addEventListener("offline", goOffline);
    return () => {
      globalThis.removeEventListener("online", goOnline);
      globalThis.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900"
    >
      <WifiOff aria-hidden className="size-4" />
      Hors ligne — lecture seule, la saisie est indisponible.
    </div>
  );
}
