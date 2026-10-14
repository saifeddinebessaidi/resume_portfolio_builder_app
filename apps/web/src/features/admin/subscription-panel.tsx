"use client";

import { type AdminPlan, Money, type Subscription } from "@repo/contracts";
import { useState, type FormEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionFeedback, Input, ReasonInput, Select, Td, Th, formatDate } from "./ui";
import { messages } from "@/messages/fr";
import { useAdminAction } from "./use-admin-action";

const t = messages.admin;

/** Every subscription the user ever had, with cancel/extend on active ones, and a grant form. */
export function SubscriptionPanel({
  userId,
  subscriptions,
  plans,
}: {
  userId: string;
  subscriptions: Subscription[];
  plans: AdminPlan[];
}): ReactNode {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("30");
  const [planCode, setPlanCode] = useState(plans.find((p) => p.isActive)?.code ?? "");
  const { run, pending, error, done } = useAdminAction();
  const noReason = reason.trim() === "";

  const after = (ok: boolean) => {
    if (ok) setReason("");
  };

  const grant = async (event: FormEvent) => {
    event.preventDefault();
    // The existing grant endpoint names its reason `note`.
    after(await run("subscriptions/grant", "POST", { userId, planCode, note: reason.trim() }));
  };

  return (
    <div className="flex flex-col gap-4">
      <ReasonInput value={reason} onChange={(e) => setReason(e.target.value)} />

      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.detail.noSubscriptions}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-border">
              <tr>
                <Th>{t.orders.plan}</Th>
                <Th>{t.orders.status}</Th>
                <Th>{messages.account.period}</Th>
                <Th>{t.orders.amount}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <Td>
                    {t.features[s.categoryCode]} · {s.planName}
                    <p className="text-xs text-muted-foreground">{s.source}</p>
                  </Td>
                  <Td>
                    <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status}</Badge>
                  </Td>
                  <Td className="text-xs">
                    {formatDate(s.startsAt)} → {formatDate(s.endsAt)}
                  </Td>
                  <Td className="text-xs">{Money.format(s.price)}</Td>
                  <Td>
                    {s.status === "ACTIVE" ? (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={3650}
                          value={days}
                          onChange={(e) => setDays(e.target.value)}
                          aria-label={t.actions.days}
                          className="w-20"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending || noReason || !(Number(days) >= 1)}
                          onClick={() =>
                            void run(`subscriptions/${s.id}/extend`, "POST", {
                              days: Number(days),
                              reason: reason.trim(),
                            }).then(after)
                          }
                        >
                          {t.actions.extend}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="quiet"
                          disabled={pending || noReason}
                          onClick={() =>
                            void run(`subscriptions/${s.id}/cancel`, "POST", {
                              reason: reason.trim(),
                            }).then(after)
                          }
                        >
                          {t.actions.cancel}
                        </Button>
                      </div>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={(e) => void grant(e)} className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t.actions.grant}</p>
        <p className="text-xs text-muted-foreground">{t.actions.grantHelp}</p>
        <div className="flex flex-wrap gap-2">
          <Select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className="flex-1">
            {plans
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.code} value={p.code}>
                  {t.features[p.categoryCode]} · {p.name} · {Money.format(p.price)}
                </option>
              ))}
          </Select>
          <Button type="submit" size="sm" disabled={pending || noReason || planCode === ""}>
            {t.actions.grant}
          </Button>
        </div>
      </form>
      <ActionFeedback error={error} done={done} />
    </div>
  );
}
