import {
  type AdminListOrdersQuery,
  ORDER_STATUSES,
  type OrderStatus,
  orderStatusSchema,
} from "@repo/contracts";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { OrdersTable } from "@/features/admin/orders-table";
import { adminApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/cn";
import { messages } from "@/messages/fr";

export const metadata: Metadata = { title: messages.admin.tabs.orders };

const t = messages.admin;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const status = orderStatusSchema.safeParse(params.status);

  const query: Partial<AdminListOrdersQuery> = {
    ...(status.success ? { status: status.data } : {}),
    ...(params.cursor ? { cursor: params.cursor } : {}),
  };
  const page = await adminApi.orders(query);

  const filters: { value: OrderStatus | null; label: string }[] = [
    { value: null, label: t.orders.all },
    ...ORDER_STATUSES.map((s) => ({ value: s, label: t.orderStatuses[s] })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        {filters.map((f) => {
          const active = (query.status ?? null) === f.value;
          return (
            <Link
              key={f.value ?? "all"}
              href={f.value ? `/admin/orders?status=${f.value}` : "/admin/orders"}
              className={cn(
                "rounded-full border px-3 py-1",
                active
                  ? "border-primary text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <Card className="p-0">
        <OrdersTable orders={page.items} />
      </Card>

      {page.nextCursor ? (
        <Link
          href={`/admin/orders?${new URLSearchParams({
            ...(query.status ? { status: query.status } : {}),
            cursor: page.nextCursor,
          }).toString()}`}
          className="self-end text-sm text-muted-foreground hover:text-foreground"
        >
          {t.users.next} →
        </Link>
      ) : null}
    </div>
  );
}
