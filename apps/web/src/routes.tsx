import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { CommandPalette } from "@/components/command-palette";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaUpdatePrompt } from "@/components/pwa-update-prompt";
import { getSession, signOut, useSession } from "@/lib/auth";
import { CompliancePage } from "@/pages/compliance-page";
import { ContractDetailPage } from "@/pages/contract-detail-page";
import { ContractsPage } from "@/pages/contracts-page";
import { CustomerDetailPage } from "@/pages/customer-detail-page";
import { CustomersPage } from "@/pages/customers-page";
import { ImportPage } from "@/pages/import-page";
import { LoginPage } from "@/pages/login-page";
import { PlanningPage } from "@/pages/planning-page";
import { SiteDetailPage } from "@/pages/site-detail-page";
import { SitesPage } from "@/pages/sites-page";
import { UsersPage } from "@/pages/users-page";
import { WorkOrderDetailPage } from "@/pages/work-order-detail-page";
import { WorkOrderNewPage } from "@/pages/work-order-new-page";
import { WorkOrdersPage } from "@/pages/work-orders-page";

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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <nav className="flex items-center gap-6">
            <span className="font-semibold">Ascenseur</span>
            <Link
              to="/"
              search={{ semaine: undefined }}
              className="text-sm text-[var(--color-muted-foreground)] hover:underline"
            >
              Planning
            </Link>
            <Link
              to="/parc"
              className="text-sm text-[var(--color-muted-foreground)] hover:underline"
            >
              Parc
            </Link>
            <Link
              to="/clients"
              className="text-sm text-[var(--color-muted-foreground)] hover:underline"
            >
              Clients
            </Link>
            <Link
              to="/contrats"
              className="text-sm text-[var(--color-muted-foreground)] hover:underline"
            >
              Contrats
            </Link>
            <Link to="/ot" className="text-sm text-[var(--color-muted-foreground)] hover:underline">
              OT
            </Link>
            <Link
              to="/conformite"
              className="text-sm text-[var(--color-muted-foreground)] hover:underline"
            >
              Conformité
            </Link>
            <Link
              to="/import"
              className="text-sm text-[var(--color-muted-foreground)] hover:underline"
            >
              Import
            </Link>
            <Link
              to="/utilisateurs"
              className="text-sm text-[var(--color-muted-foreground)] hover:underline"
            >
              Utilisateurs
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
      {/* Élargi au lot L1.7 : le planning porte sept colonnes de jours plus
          une colonne de techniciens, et 1024 pixels ne suffisaient plus. */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      {/* Montée sous la garde d'authentification : elle cherche dans le tenant
          de la session, elle n'a rien à faire sur l'écran de connexion. */}
      <CommandPalette />
    </>
  );
}

/**
 * Le planning est la page d'accueil, pas un module (`07-principes-ux.md`,
 * règle 1). La semaine affichée vit dans l'URL : un planning se partage par
 * lien, et l'état survit à un rechargement (règle 3).
 */
const planningRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>) => ({
    semaine: typeof search.semaine === "string" ? search.semaine : undefined,
  }),
  component: PlanningRoute,
});

function PlanningRoute(): React.JSX.Element {
  const { semaine } = planningRoute.useSearch();
  return <PlanningPage week={semaine} />;
}

const sitesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/parc",
  component: SitesPage,
});

const siteDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/sites/$siteId",
  component: SiteDetailPage,
});

const customersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/clients",
  component: CustomersPage,
});

const customerDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/clients/$customerId",
  component: CustomerDetailPage,
});

const contractsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/contrats",
  component: ContractsPage,
});

const contractDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/contrats/$contractId",
  component: ContractDetailPage,
});

const workOrdersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/ot",
  component: WorkOrdersPage,
});

/** Déclarée avant la route dynamique : « nouveau » n'est pas un identifiant. */
const workOrderNewRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/ot/nouveau",
  component: WorkOrderNewPage,
});

const workOrderDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/ot/$workOrderId",
  component: WorkOrderDetailPage,
});

const complianceRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/conformite",
  component: CompliancePage,
});

const importRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/import",
  component: ImportPage,
});

const usersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/utilisateurs",
  component: UsersPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: () => {
    if (getSession() !== null) {
      throw redirect({ to: "/", search: { semaine: undefined } });
    }
  },
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([
  authenticatedRoute.addChildren([
    planningRoute,
    sitesRoute,
    siteDetailRoute,
    customersRoute,
    customerDetailRoute,
    contractsRoute,
    contractDetailRoute,
    workOrdersRoute,
    workOrderNewRoute,
    workOrderDetailRoute,
    complianceRoute,
    importRoute,
    usersRoute,
  ]),
  loginRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
