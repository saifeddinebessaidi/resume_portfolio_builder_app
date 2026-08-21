"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { messages } from "@/messages/fr";

/**
 * The error boundary for the whole app.
 *
 * `error.digest` is Next's server-side correlation id. It is the only part of a production error that
 * is safe to show — the message itself is redacted by Next before it reaches the browser, which is
 * exactly the behaviour we want and the reason this displays the digest rather than `error.message`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactNode {
  useEffect(() => {
    // Kept as console.error deliberately: there is no error-reporting service on this project, and a
    // silent boundary is worse than a noisy one.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl">{messages.errors.errorTitle}</h1>
      <p className="max-w-md text-muted-foreground">{messages.errors.errorBody}</p>

      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          {messages.errors.reference}: {error.digest}
        </p>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
      >
        {messages.errors.retry}
      </button>
    </main>
  );
}
