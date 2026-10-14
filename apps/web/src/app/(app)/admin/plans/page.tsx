import { Money } from "@repo/contracts";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.admin.tabs.plans };

const t = messages.admin;

/** Read-only in v1: plans are data (ADR-0005) changed by migration, and every price is snapshotted. */
export default async function AdminPlansPage(): Promise<ReactNode> {
  const { plans } = await adminApi.plans();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t.plans.readOnly}</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.code}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {t.features[plan.categoryCode]} · {plan.name}
                {plan.isActive ? null : <Badge tone="warning">{t.plans.inactive}</Badge>}
              </CardTitle>
              <CardDescription>
                {plan.code} · {Money.format(plan.price)} · {t.plans.duration(plan.durationDays)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">{t.plans.active(plan.activeSubscriptions)}</p>
              <ul className="flex flex-col gap-1">
                {plan.entitlements.map((e) => (
                  <li key={e.key} className="flex justify-between gap-4">
                    <span>{t.entitlementKeys[e.key]}</span>
                    <span className="tabular-nums">{e.limitValue ?? messages.quota.unlimited}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
