import { type AdminOrder, Money } from "@repo/contracts";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { OrderActions } from "./order-actions";
import { Td, Th, formatDate } from "./ui";
import { messages } from "@/messages/fr";

const t = messages.admin;

const tone = (status: AdminOrder["status"]) =>
  status === "PAID" ? "success" : status === "PENDING" ? "info" : "neutral";

/** Shared by the payments tab and the user detail, so both show the same columns and actions. */
export function OrdersTable({
  orders,
  showUser = true,
}: {
  orders: AdminOrder[];
  showUser?: boolean;
}): ReactNode {
  if (orders.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t.detail.noOrders}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead className="border-b border-border">
          <tr>
            <Th>{t.orders.date}</Th>
            {showUser ? <Th>{t.orders.user}</Th> : null}
            <Th>{t.orders.plan}</Th>
            <Th>{t.orders.amount}</Th>
            <Th>{t.orders.status}</Th>
            <Th>{t.orders.payments}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border last:border-0">
              <Td className="text-xs">
                {formatDate(o.createdAt)}
                {o.invoiceNumber ? (
                  <p className="text-muted-foreground">{o.invoiceNumber}</p>
                ) : null}
              </Td>
              {showUser ? (
                <Td>
                  <Link href={`/admin/users/${o.user.id}`} className="hover:underline">
                    {o.user.email}
                  </Link>
                </Td>
              ) : null}
              <Td>
                {t.features[o.categoryCode]} · {o.planCode}
              </Td>
              <Td className="tabular-nums">{Money.format(o.amount)}</Td>
              <Td>
                <Badge tone={tone(o.status)}>{t.orderStatuses[o.status]}</Badge>
              </Td>
              <Td className="text-xs">
                {o.payments.length === 0
                  ? "—"
                  : o.payments.map((p) => (
                      <p key={p.id}>
                        {p.provider} · {p.status} · {Money.format(p.amount)}
                        {p.providerRef ? ` · ${p.providerRef}` : ""}
                      </p>
                    ))}
              </Td>
              <Td>
                <OrderActions order={o} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
