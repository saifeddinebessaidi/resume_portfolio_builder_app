import { Money } from "@repo/contracts";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuotaBadge } from "@/features/dashboard/quota-badge";
import { SignOutButton } from "@/features/account/sign-out-button";
import { meApi, subscriptionsApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );

export const metadata: Metadata = { title: messages.account.title };

export default async function AccountPage(): Promise<ReactNode> {
  // Three independent reads, issued together rather than sequentially: none depends on another, so
  // awaiting them in series would triple the latency of the slowest one for no reason.
  const [me, subs, entitlements] = await Promise.all([
    meApi.get(),
    subscriptionsApi.list(),
    subscriptionsApi.entitlements(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">
        <span className="rc-gradient-text">{messages.account.title}</span>
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{messages.account.profile}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{messages.account.email}</p>
            <p className="font-medium">{me.email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{messages.account.fullName}</p>
            <p className="font-medium">{me.fullName ?? "—"}</p>
          </div>
          <div className="pt-2">
            <SignOutButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.account.subscriptions}</CardTitle>
          <CardDescription>
            {subs.subscriptions.length === 0 ? messages.account.noSubscriptions : null}
          </CardDescription>
        </CardHeader>

        {subs.subscriptions.length > 0 ? (
          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {subs.subscriptions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                >
                  <div>
                    <p className="font-medium">{s.planCode}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(s.startsAt)} → {formatDate(s.endsAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Formatted through Money, which owns the currency exponent — TND has three
                        decimals, so a /100 anywhere else would render 25 TND as 250.00. ADR-0006. */}
                    <span className="font-mono text-sm">{Money.format(s.price)}</span>
                    <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>

      {entitlements.categories.map((category) => (
        <Card key={category.categoryCode}>
          <CardHeader>
            <CardTitle>{category.categoryCode}</CardTitle>
            <CardDescription>
              {category.subscription
                ? `${category.subscription.planCode} · ${messages.quota.resetsOn} ${formatDate(category.subscription.endsAt)}`
                : messages.blocked.NO_ACTIVE_SUBSCRIPTION}
            </CardDescription>
          </CardHeader>
          {category.entitlements.length > 0 ? (
            <CardContent className="flex flex-wrap gap-2">
              {category.entitlements.map((e) => (
                <QuotaBadge key={e.key} entitlement={e} />
              ))}
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
