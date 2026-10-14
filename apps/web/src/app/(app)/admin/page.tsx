import { Money } from "@repo/contracts";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.admin.title };

const t = messages.admin.metrics;

function Stat({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-display text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/** One line per currency: amounts in different currencies are never summed. */
const formatRevenue = (amounts: Money[]): string =>
  amounts.length === 0 ? "0" : amounts.map((m) => Money.format(m)).join(" · ");

export default async function AdminOverviewPage(): Promise<ReactNode> {
  const metrics = await adminApi.metrics();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t.users} value={metrics.users.total} />
        <Stat label={t.new7d} value={metrics.users.new7d} />
        <Stat label={t.new30d} value={metrics.users.new30d} />
        <Stat label={t.suspended} value={metrics.users.suspended} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label={t.revenue30d} value={formatRevenue(metrics.revenue.last30d)} />
        <Stat label={t.revenueAll} value={formatRevenue(metrics.revenue.allTime)} />
        <Stat label={t.pendingOrders} value={metrics.pendingOrders} />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{t.grantsExcluded}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t.activeSubscriptions}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {metrics.activeSubscriptions.map((row) => (
            <div key={row.categoryCode}>
              <p className="text-sm text-muted-foreground">
                {messages.admin.features[row.categoryCode]}
              </p>
              <p className="font-display text-2xl tabular-nums">{row.count}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
