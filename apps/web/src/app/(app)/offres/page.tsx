import {
  CATEGORY_CODES,
  EntitlementKey,
  Money,
  type CategoryCode,
  type Plan,
} from "@repo/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { catalogApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.offers.title };

/**
 * The offers page — where a blocked download sends the user.
 *
 * Built entirely from `GET /catalog/categories/:code/plans`, so prices, badges, marketing bullets **and**
 * the enforced entitlements all come from the seeded catalog. Nothing here is hardcoded: changing a price
 * or a quota is an `UPDATE`, not a deploy (ADR-0005), and this page reflects it on the next load.
 *
 * It shows both `features` (the marketing bullets) and `entitlements` (the numbers actually enforced),
 * side by side. That is deliberate — it is exactly the divergence `PlanFeature` and `PlanEntitlement`
 * were kept apart to make visible, and a customer deserves to see what is enforced rather than only what
 * is advertised.
 */
const ENTITLEMENT_LABELS: Record<string, string> = {
  [EntitlementKey.PROJECT_CREATE_QUOTA]: messages.quota.createQuota,
  [EntitlementKey.REVISION_PER_PROJECT]: messages.quota.revisions,
  [EntitlementKey.EXPORT_PER_PROJECT]: messages.quota.exports,
  [EntitlementKey.PUBLICATION_SLOT]: messages.quota.publications,
  [EntitlementKey.CUSTOM_SLUG]: messages.quota.customSlug,
  [EntitlementKey.HOSTING_DAYS]: messages.quota.hosting,
  [EntitlementKey.ASSET_STORAGE_MB]: messages.quota.storage,
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; category?: string }>;
}): Promise<ReactNode> {
  const { from, category } = await searchParams;

  /**
   * Arriving from a blocked download shows **only that category's plans**.
   *
   * Someone who just tried to download a CV wants a CV plan; showing them portfolio offers as well
   * makes them do the filtering, and a page with nine cards buries the three that matter. The
   * parameter is validated against the enum rather than trusted, so a junk value falls back to
   * everything instead of rendering an empty page.
   */
  const requested = CATEGORY_CODES.find((c) => c === category);
  const shown = requested ? [requested] : CATEGORY_CODES;

  // Issued together — round trips in series would multiply the wait by the number of categories.
  const catalogs = await Promise.all(shown.map((code) => catalogApi.plans(code)));

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-reveal">
        <h1 className="font-display text-3xl md:text-4xl">
          <span className="rc-gradient-text">{messages.offers.title}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{messages.offers.subtitle}</p>

        {/* Arrived from a blocked download: say so, so the page does not feel like a random detour. */}
        {from === "download" ? (
          <p className="mt-3 rounded-2xl border border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] px-4 py-3 text-sm">
            {messages.offers.fromDownload}
          </p>
        ) : null}

        {/* Filtered to one category — offer the way back to the rest rather than stranding them. */}
        {requested ? (
          <Link href="/offres" className="mt-3 inline-block text-sm text-primary underline">
            {messages.offers.seeAll}
          </Link>
        ) : null}
      </div>

      {catalogs.map(({ category, plans }) => (
        <section key={category.code} className="flex flex-col gap-4">
          <h2 className="font-display text-xl">{category.name}</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.code} plan={plan} categoryCode={category.code} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PlanCard({ plan, categoryCode }: { plan: Plan; categoryCode: CategoryCode }): ReactNode {
  return (
    <Card hoverable className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{plan.name}</CardTitle>
          {plan.badge ? <Badge tone="warning">{plan.badge}</Badge> : null}
        </div>

        {/* Formatted through Money, the only place that knows TND has three decimals (ADR-0006). */}
        <p className="font-display text-3xl">
          <span className="rc-gradient-text">{Money.format(plan.price)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {plan.durationDays} jours · {categoryCode}
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {messages.offers.included}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {plan.features.map((f) => (
              <li key={f.label} className="flex gap-2">
                <span aria-hidden className="text-primary">
                  ·
                </span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {messages.offers.limits}
          </p>
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {plan.entitlements.map((e) => (
              <li key={e.key}>
                {ENTITLEMENT_LABELS[e.key] ?? e.key} :{" "}
                {/* `??` is correct: `limitValue` is `number | null`, and 0 ("explicitly
                    denied") is preserved rather than falling through. */}
                {e.limitValue ?? messages.quota.unlimited}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          {/* No checkout exists yet — that is phase 7. A disabled button that says so beats a button
              that leads nowhere. */}
          <Button type="button" disabled className="w-full">
            {messages.offers.comingSoon}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{messages.offers.contactUs}</p>
        </div>
      </CardContent>
    </Card>
  );
}
