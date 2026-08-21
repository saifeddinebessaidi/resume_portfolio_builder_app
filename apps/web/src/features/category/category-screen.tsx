import { CATEGORY_SLUGS, type CategoryCode, type DashboardCategory } from "@repo/contracts";
import { Pencil } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CreateProjectButton } from "./create-project-button";
import { ProgressBar } from "@/features/dashboard/progress-bar";
import { PublicLink } from "@/features/dashboard/public-link";
import { QuotaBadge } from "@/features/dashboard/quota-badge";
import { StatusBadge } from "@/features/dashboard/status-badge";
import { UpgradeButton } from "@/features/subscriptions/upgrade-button";
import { emptyCopyFor } from "@/features/dashboard/empty-state";
import { dashboardApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );

/**
 * One screen for all three categories.
 *
 * The three category pages are the same screen with a different `CategoryCode` — the front-end mirror
 * of the single-`Project`-table decision (ADR-0004). Adding a fourth category later would be a seed row
 * and a route file, not a new screen.
 *
 * The editor area is a placeholder, but **the frame is real**: breadcrumb, quota header, project list.
 * Phases 4–6 mount a builder into a finished frame instead of building the frame three times — which is
 * the whole reason step 07 exists rather than being deferred with the builders.
 */
export async function CategoryScreen({ code }: { code: CategoryCode }): Promise<ReactNode> {
  // Reuses the dashboard summary rather than adding an endpoint: it already carries this category's
  // subscription, entitlements and recent projects, and it is one cached round trip.
  const summary = await dashboardApi.summary();
  const category: DashboardCategory | undefined = summary.categories.find((c) => c.code === code);
  const copy = emptyCopyFor(code);

  if (!category) {
    return <p className="text-muted-foreground">{messages.errors.generic}</p>;
  }

  /**
   * Measured on `total`, not on `items.length`.
   *
   * `items` is the first page of recent projects, so a user deep in a paginated list could have an
   * empty page and be told they own nothing. `total` is the count the server actually holds.
   */
  const isEmpty = category.projects.total === 0;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          {messages.nav.home}
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span className="text-foreground">{category.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">
            <span className="rc-gradient-text">{category.name}</span>
          </h1>
          <p className="text-muted-foreground">
            {category.projects.total}{" "}
            {category.projects.total === 1 ? messages.common.project : messages.common.projects}
            {/* The list below is the same capped page the dashboard shows, so say so here too. */}
            {category.projects.items.length < category.projects.total
              ? ` · ${messages.common.showingOf(category.projects.items.length, category.projects.total)}`
              : ""}
          </p>
        </div>

        {category.subscription ? (
          <Badge tone="info">
            {category.subscription.planName} · {messages.quota.resetsOn}{" "}
            {formatDate(category.subscription.endsAt)}
          </Badge>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">{messages.blocked.NO_ACTIVE_SUBSCRIPTION}</Badge>
            <UpgradeButton categoryCode={code} />
          </div>
        )}
      </div>

      {category.entitlements.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {category.entitlements.map((e) => (
            <QuotaBadge key={e.key} entitlement={e} />
          ))}
        </div>
      ) : null}

      {/**
       * Where the create action lives, and the only placeholder on the screen — everything around it
       * is the real layout, so phases 4–6 mount a builder into a finished frame.
       *
       * The button is disabled only when the server says creation is impossible, and then the reason
       * is stated next to it with the actual numbers. That is the one place a refusal belongs: at the
       * point of action, not on the dashboard button that got the user here.
       */}
      <Card className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        {/**
         * **"Vous n'avez pas encore de CV" only when that is true.**
         *
         * It was rendered unconditionally, so it sat above a list of the user's own CVs telling them
         * they had none. The empty-state copy now shows only while the category is empty; once
         * something exists the card leads with the create action instead of denying it.
         */}
        {isEmpty ? (
          <>
            <p className="font-display text-xl">{copy.title}</p>
            <p className="max-w-md text-sm text-muted-foreground">{copy.body}</p>
          </>
        ) : (
          <p className="font-display text-xl">{copy.cta}</p>
        )}

        {/**
         * **Never disabled for lack of a subscription.** Creating is free (ADR-0012), so a visitor with
         * no plan builds first and meets the paywall at download.
         *
         * It still stops for a *paying* customer whose create allowance is spent — that is a real
         * limit with real numbers, and letting them press it would produce a 403 the UI promised
         * wouldn't happen.
         */}
        <CreateProjectButton categoryCode={code} label={copy.cta} disabled={!category.canCreate} />

        {!category.canCreate && category.blockedReason ? (
          <p className="text-xs text-muted-foreground">
            {category.subscription
              ? messages.blocked[category.blockedReason]
              : messages.blocked.freeTierUsed}
          </p>
        ) : null}
      </Card>

      {category.projects.items.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.common.projects}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {category.projects.items.map((project) => {
                const meta = (
                  <>
                    <p className="truncate font-medium">{project.title}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {messages.common.modifiedOn} {formatDate(project.updatedAt)}
                      </span>
                      <ProgressBar
                        percent={project.completionPercent}
                        label={`${messages.quota.progress} — ${project.title}`}
                      />
                    </div>
                  </>
                );

                /**
                 * **The edit action lives here**, not on the dashboard.
                 *
                 * This screen lists one category's own projects, which is where someone goes when they
                 * mean to work on one — the dashboard is an overview and its job is the create button.
                 *
                 * The row itself is clickable *and* the explicit button sits alongside it: a whole-row
                 * link is convenient but invisible, and a user looking for "how do I edit this" needs to
                 * see the verb.
                 *
                 * All three categories now have an editor, so the disabled branch this once needed for
                 * Portfolio is gone — `/portfolio/[id]` and `/portfolio-pro/[id]` exist.
                 */
                const href =
                  code === "RESUME"
                    ? (`/resume/${project.id}` as const)
                    : code === "PORTFOLIO"
                      ? (`/portfolio/${project.id}` as const)
                      : (`/portfolio-pro/${project.id}` as const);

                return (
                  <li
                    key={project.id}
                    className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]"
                  >
                    {/**
                     * `PublicLink` is a sibling of the row link, never a child of it: an anchor inside an
                     * anchor is invalid HTML, and browsers recover from it by closing the outer one — so
                     * the nested "open" link would be unclickable while the rest of the row silently
                     * stopped being a link at all.
                     */}
                    <div className="min-w-0 flex-1">
                      <Link href={href} className="block min-w-0">
                        {meta}
                      </Link>
                      {project.publicUrl ? <PublicLink url={project.publicUrl} /> : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={project.status} />
                      <Link
                        href={href}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                      >
                        <Pencil aria-hidden className="size-4" />
                        {messages.common.edit}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {CATEGORY_SLUGS[code]} · {code}
      </p>
    </div>
  );
}
