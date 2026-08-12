import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaUpdatePrompt } from "@/components/pwa-update-prompt";
import { getSession, signOut, useSession } from "@/lib/auth";
import { LoginPage } from "@/pages/login-page";
import { UnitsPage } from "@/pages/units-page";

/**
 * Routes du back-office, définies en code plutôt qu'en fichiers : pas d'étape
 * de génération à faire tourner en CI pour trois routes.
 *
 * Les gardes lisent la session via `getSession()`, jamais via un état React —
 * `beforeLoad` s'exécute avant le rendu, un état serait en retard d'un tour.
 */

const rootRoute = createRootRoute({ component: RootLayout });

function RootLayout(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <Outlet />
      <PwaUpdatePrompt />
    </div>
  );
}

/** Tout ce qui vit sous cette route exige une session. */
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  beforeLoad: ({ location }) => {
    if (getSession() === null) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout(): React.JSX.Element {
  const session = useSession();

  return (
    <>
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <nav className="flex items-center gap-6">
            <span className="font-semibold">Ascenseur</span>
            <Link to="/" className="text-sm text-[var(--color-muted-foreground)] hover:underline">
              Parc
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span data-testid="session-email" className="text-sm">
              {session?.user.email}
            </span>
            <button
              type="button"
              onClick={() => {
                signOut();
                void router.navigate({ to: "/login", search: { redirect: undefined } });
              }}
              className="text-sm text-[var(--color-muted-foreground)] hover:underline"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </>
  );
}

const unitsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  component: UnitsPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: () => {
    if (getSession() !== null) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([authenticatedRoute.addChildren([unitsRoute]), loginRoute]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
