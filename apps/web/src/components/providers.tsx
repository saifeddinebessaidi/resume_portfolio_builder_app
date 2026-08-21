"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { isApiProblem } from "@/lib/api/problem";

export function Providers({ children }: { children: ReactNode }): ReactNode {
  // Created in state, not at module scope: a module-level client would be shared across every
  // request during SSR, so one user's dashboard could be served from another user's cache.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,

            /**
             * A `403 ENTITLEMENT_EXHAUSTED` is a **correct, final answer** — not a transient
             * failure. Retrying it three times wastes requests and delays the message the user
             * actually needs to read. Only 5xx is worth retrying.
             */
            retry: (failureCount, error) => {
              if (isApiProblem(error) && error.status < 500) return false;
              return failureCount < 2;
            },

            // The dashboard is not a live feed; refetching on every tab switch is noise.
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
