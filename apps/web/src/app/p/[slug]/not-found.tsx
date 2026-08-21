import type { ReactNode } from "react";

import { messages } from "@/messages/fr";

/**
 * The 404 a visitor sees, scoped to `/p/*` so it does not carry the app's own "retour au tableau de
 * bord" copy — the person reading it has no account here.
 *
 * **Deliberately vague about the cause.** The API returns one 404 for a slug that never existed, one that
 * was unpublished, one whose hosting term ran out and one whose project was deleted, so that a visitor
 * cannot learn that a portfolio *used to* live at an address. Saying "this link has expired" here would
 * hand back exactly the distinction that was hidden.
 */
export default function PublicNotFound(): ReactNode {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl">{messages.portfolio.notFoundTitle}</h1>
      <p className="text-sm text-muted-foreground">{messages.portfolio.notFoundBody}</p>
    </main>
  );
}
