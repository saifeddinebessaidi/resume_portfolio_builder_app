"use client";

import { type AdminOrder } from "@repo/contracts";
import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ActionFeedback, Input, ReasonInput } from "./ui";
import { messages } from "@/messages/fr";
import { useAdminAction } from "./use-admin-action";

const t = messages.admin;

/**
 * Mark paid (PENDING) or refund (PAID). Opens inline rather than in a dialog: one order at a time, and
 * the reason field has to be filled anyway.
 */
export function OrderActions({ order }: { order: AdminOrder }): ReactNode {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const { run, pending, error, done } = useAdminAction();

  const action =
    order.status === "PENDING" ? "mark-paid" : order.status === "PAID" ? "refund" : null;
  if (!action) return null;

  const label = action === "mark-paid" ? t.orders.markPaid : t.orders.refund;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run(`orders/${order.id}/${action}`, "POST", {
      reason: reason.trim(),
      ...(action === "mark-paid" && providerRef.trim() ? { providerRef: providerRef.trim() } : {}),
    });
    if (ok) setOpen(false);
  };

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          {label}
        </Button>
        <ActionFeedback error={null} done={done} />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex min-w-64 flex-col gap-2">
      {action === "mark-paid" ? (
        <Input
          value={providerRef}
          onChange={(e) => setProviderRef(e.target.value)}
          placeholder={t.orders.providerRef}
          maxLength={255}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{t.orders.refundNote}</p>
      )}
      <ReasonInput value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="quiet" onClick={() => setOpen(false)}>
          ✕
        </Button>
        <Button type="submit" size="sm" disabled={pending || reason.trim() === ""}>
          {label}
        </Button>
      </div>
      <ActionFeedback error={error} done={false} />
    </form>
  );
}
