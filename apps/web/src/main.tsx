import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { router } from "@/routes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Le réseau peut manquer (ADR-003) : on ne s'acharne pas, le bandeau
      // hors ligne informe et la donnée en cache reste affichée.
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Élément racine introuvable");
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
