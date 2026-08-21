import { type Currency, type PaymentProviderCode, type PaymentStatus } from "@repo/contracts";

/**
 * One money movement against an order.
 *
 * Several per order is the normal case, not an edge case: a declined card followed by a
 * successful one, a bank transfer that arrives days after the intent, and a refund recorded as a
 * second movement against an order already paid. None of the three is representable if payment
 * state lives on the order row — see ADR-0007.
 */
export interface Payment {
  id: string;
  orderId: string;
  provider: PaymentProviderCode;
  status: PaymentStatus;
  amountMinor: number;
  currency: Currency;
  /** The gateway's transaction id. `null` for a manual activation, which has no gateway. */
  providerRef: string | null;
  occurredAt: Date;
  createdAt: Date;
}

/**
 * Whether the recorded movements settle the order.
 *
 * `>=` rather than `===`: an overpayment (a bank transfer rounded up, a duplicated wire) still
 * settles the order. Refunding the difference is a separate movement, and refusing to mark the
 * order paid would leave a customer who has demonstrably paid without their subscription.
 */
export const coversAmount = (payments: Payment[], amountMinor: number): boolean =>
  payments.filter((p) => p.status === "SUCCEEDED").reduce((sum, p) => sum + p.amountMinor, 0) >=
  amountMinor;
