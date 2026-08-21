import { CATEGORY_SLUGS, type DashboardCategory } from "@repo/contracts";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectButton } from "@/features/category/create-project-button";
import { EmptyState, emptyCopyFor } from "./empty-state";
import { ProgressBar } from "./progress-bar";
import { PublicLink } from "./public-link";
import { StatusBadge } from "./status-badge";
import { UpgradeButton } from "@/features/subscriptions/upgrade-button";
import { QuotaBadge } from "./quota-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { messages } from "@/messages/fr";

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );

/**
 * One of the three dashboard tables.
 *
 * A server component: it receives its slice of the summary and renders. No fetching, no client state,
 * no loading skeleton — the whole screen arrives in one round trip, which is why
 * `GET /dashboard/summary` was shaped the way it was in phase 2 step 10.
 *
 * `canCreate` and `blockedReason` are read straight from the response. The client deliberately does
 * **not** re-derive "may this user create" from the entitlement numbers: that logic would then exist in
 * two places and drift, and the UI would eventually enable a button the API rejects.
 *
 * ## No per-row edit action here
 *
 * It had one briefly and it was the wrong place. This table is an **overview** — a capped five-row
 * window across three categories — so a row-level verb competes with the one action the screen exists to
 * offer: create. Editing belongs on the category screen, which lists a category's own projects and is
 * where someone goes when they mean to work on one. `Voir tout` is the route between the two.
 */
export function CategoryTable({ category }: { category: DashboardCategory }): ReactNode {
  const slug = CATEGORY_SLUGS[category.code];
  const copy = emptyCopyFor(category.code);
  const isEmpty = category.projects.items.length === 0;

  /**
   * **The CTA creates the project and lands the user in the form — one click, no stop on the way.**
   *
   * It used to link to the category screen, which then had its own create button: two clicks and an
   * intermediate page to reach a form the user had already asked for. `CreateProjectButton` posts to
   * `/api/projects` and pushes straight to `/resume/:id`.
   *
   * **All three categories now do this.** The other two used to link to their category screen because
   * they had no editor to land in, and leaving that in place after `/portfolio/[id]` shipped is what
   * produced the reported behaviour — pressing "Créer mon portfolio" added a row and went nowhere.
   *
   * Disabled straight from `canCreate`, with no client-side qualifier.
   *
   * It used to read `subscription !== null && !canCreate`, because the server returned a flat `false`
   * for every unsubscribed account and trusting it would have disabled the button for exactly the
   * visitors ADR-0012 wanted building. The resolver now reports the real free allowance, so the UI can
   * stop second-guessing it — and the free cap is enforced in `POST /projects` regardless, because a
   * disabled button stops nobody with `curl`.
   */
  const createButton = (
    <CreateProjectButton
      categoryCode={category.code}
      label={copy.cta}
      disabled={!category.canCreate}
    />
  );

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{category.name}</CardTitle>

          {/**
           * No subscription is now **red, and actionable**.
           *
           * It was a neutral grey badge that stated a problem and offered no way out of it — the user
           * had to know that offers existed and go looking for the page. Red because this is the one
           * thing on the row standing between them and downloading their work, and the button beside it
           * goes straight to *this* category's plans rather than a page of all nine.
           */}
          {category.subscription ? (
            <Badge tone="info">
              {category.subscription.planName} · {messages.quota.resetsOn}{" "}
              {formatDate(category.subscription.endsAt)}
            </Badge>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="danger">{messages.blocked.NO_ACTIVE_SUBSCRIPTION}</Badge>
              <UpgradeButton categoryCode={category.code} />
            </div>
          )}
        </div>

        {category.entitlements.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {category.entitlements.map((entitlement) => (
              <QuotaBadge key={entitlement.key} entitlement={entitlement} />
            ))}
          </div>
        ) : null}

        {/**
         * Why creation is blocked, when it is.
         *
         * A free account that has used its one slot gets different copy from a paying customer whose
         * monthly quota is spent: the first is an upsell, the second is a wait-for-renewal. Same
         * `blockedReason` from the API — `subscription === null` is what tells them apart.
         */}
        {category.blockedReason ? (
          <p className="text-sm text-muted-foreground">
            {category.subscription
              ? messages.blocked[category.blockedReason]
              : messages.blocked.freeTierUsed}
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {isEmpty ? (
          <EmptyState categoryCode={category.code} action={createButton} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{category.name}</caption>
                <thead>
                  <tr className="border-y border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-6 py-2 font-medium">
                      Projet
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Statut
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {messages.quota.progress}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {messages.quota.exports}
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      {messages.common.modifiedOn}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {category.projects.items.map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]"
                    >
                      <td className="max-w-[26ch] px-6 py-3 font-medium">
                        <span className="block truncate">{project.title}</span>
                        {/* The generated link, with its copy action — reachable from the row rather than
                            only from the editor that created it. */}
                        {project.publicUrl ? <PublicLink url={project.publicUrl} /> : null}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-3 py-3">
                        <ProgressBar
                          percent={project.completionPercent}
                          label={`${messages.quota.progress} — ${project.title}`}
                        />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {project.exportCount}/{project.exportLimit ?? "∞"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatDate(project.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-6 py-3">
              <p className="text-sm text-muted-foreground">
                {/* Two different facts, and the table needs both: how many exist, and how many of them
                    this view is actually showing. */}
                {category.projects.items.length < category.projects.total
                  ? messages.common.showingOf(
                      category.projects.items.length,
                      category.projects.total,
                    )
                  : `${String(category.projects.total)} ${
                      category.projects.total === 1
                        ? messages.common.project
                        : messages.common.projects
                    }`}
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={`/${slug}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  {messages.common.seeAll}
                </Link>
                {createButton}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
