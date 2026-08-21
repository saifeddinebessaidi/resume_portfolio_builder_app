import { type CategoryCode } from "@repo/contracts";
import type { ReactNode } from "react";

import { messages } from "@/messages/fr";

/**
 * The per-category empty state.
 *
 * **Not an edge case — this is the first screen every new user sees**, immediately after paying or
 * just before. The brief describes it explicitly: an empty table with text explaining what to do and a
 * button that starts the thing. So it gets copy per category rather than one generic "no data" line.
 */
const COPY: Record<CategoryCode, { title: string; body: string; cta: string }> = {
  RESUME: {
    title: messages.dashboard.empty.resumeTitle,
    body: messages.dashboard.empty.resumeBody,
    cta: messages.dashboard.empty.resumeCta,
  },
  PORTFOLIO: {
    title: messages.dashboard.empty.portfolioTitle,
    body: messages.dashboard.empty.portfolioBody,
    cta: messages.dashboard.empty.portfolioCta,
  },
  PORTFOLIO_PRO: {
    title: messages.dashboard.empty.portfolioProTitle,
    body: messages.dashboard.empty.portfolioProBody,
    cta: messages.dashboard.empty.portfolioProCta,
  },
};

export const emptyCopyFor = (code: CategoryCode) => COPY[code];

export function EmptyState({
  categoryCode,
  action,
}: {
  categoryCode: CategoryCode;
  action: ReactNode;
}): ReactNode {
  const copy = COPY[categoryCode];

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="font-display text-base">{copy.title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{copy.body}</p>
      <div className="mt-1">{action}</div>
    </div>
  );
}
