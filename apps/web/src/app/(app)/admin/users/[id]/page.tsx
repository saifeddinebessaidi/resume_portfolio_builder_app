import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureAccessPanel } from "@/features/admin/feature-access-panel";
import { LimitOverridesPanel } from "@/features/admin/limit-overrides-panel";
import { OrdersTable } from "@/features/admin/orders-table";
import { SubscriptionPanel } from "@/features/admin/subscription-panel";
import { UserProfileControls } from "@/features/admin/user-profile-controls";
import { adminApi, meApi } from "@/lib/api/endpoints";
import { formatDate } from "@/features/admin/ui";
import { isApiProblem } from "@/lib/api/problem";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.admin.tabs.users };

const t = messages.admin;

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;

  const [detail, plans, me] = await Promise.all([
    adminApi.user(id).catch((error: unknown) => {
      if (isApiProblem(error) && error.code === "NOT_FOUND") notFound();
      throw error;
    }),
    adminApi.plans(),
    meApi.get(),
  ]);

  // The plan's own limit beside each override, from the user's active plan per category.
  const planLimits: Record<string, number | null> = {};
  for (const category of detail.entitlements) {
    const plan = plans.plans.find((p) => p.code === category.subscription?.planCode);
    for (const e of plan?.entitlements ?? []) {
      planLimits[`${category.categoryCode}:${e.key}`] = e.limitValue;
    }
  }

  const { user } = detail;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
        {t.detail.back}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {user.email}
            <Badge tone={user.role === "ADMIN" ? "info" : "neutral"}>{t.roles[user.role]}</Badge>
            <Badge tone={user.status === "ACTIVE" ? "success" : "warning"}>
              {t.statuses[user.status]}
            </Badge>
          </CardTitle>
          <CardDescription>
            {user.fullName ?? "—"} · {t.users.createdAt} {formatDate(user.createdAt)} ·{" "}
            {t.users.lastSeen} {formatDate(user.lastSeenAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserProfileControls user={user} isSelf={user.id === me.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.detail.subscriptions}</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionPanel
            userId={user.id}
            subscriptions={detail.subscriptions}
            plans={plans.plans}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.detail.access}</CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureAccessPanel userId={user.id} overrides={detail.accessOverrides} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.detail.limits}</CardTitle>
          </CardHeader>
          <CardContent>
            <LimitOverridesPanel
              userId={user.id}
              overrides={detail.entitlementOverrides}
              entitlements={detail.entitlements}
              planLimits={planLimits}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="p-0">
        <CardHeader>
          <CardTitle>{t.detail.payments}</CardTitle>
        </CardHeader>
        <OrdersTable orders={detail.orders} showUser={false} />
      </Card>
    </div>
  );
}
