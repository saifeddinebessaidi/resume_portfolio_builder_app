import Link from "next/link";
import type { ReactNode } from "react";

import { messages } from "@/messages/fr";

/**
 * Written now, not later. Without it Next serves its own error page — untranslated, and in some
 * configurations leaking a stack trace.
 */
export default function NotFound(): ReactNode {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-6xl text-gradient">404</p>
      <h1 className="font-display text-2xl">{messages.errors.notFoundTitle}</h1>
      <p className="max-w-md text-muted-foreground">{messages.errors.notFoundBody}</p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
      >
        {messages.errors.backHome}
      </Link>
    </main>
  );
}
