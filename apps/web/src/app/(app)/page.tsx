import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CategoryTable } from "@/features/dashboard/category-table";
import { dashboardApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.nav.home };

/**
 * The home dashboard: three tables, in one round trip.
 *
 * A server component calling the API directly, which is only possible because the session lives in a
 * cookie a server component can read — the concrete payoff of that decision in `lib/auth/session.ts`.
 * The first paint therefore has real data and no spinner.
 */
export default async function DashboardPage(): Promise<ReactNode> {
  const summary = await dashboardApi.summary();
  const name = summary.user.fullName ?? summary.user.email.split("@")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-reveal">
        <h1 className="font-display text-3xl md:text-4xl">
          {messages.dashboard.greeting} <span className="rc-gradient-text">{name}</span>
        </h1>
        <p className="mt-2 text-muted-foreground">{messages.dashboard.subtitle}</p>
      </div>

      <div className="flex flex-col gap-5">
        {summary.categories.map((category) => (
          <CategoryTable key={category.code} category={category} />
        ))}
      </div>
    </div>
  );
}
