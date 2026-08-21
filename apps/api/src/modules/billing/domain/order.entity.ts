import { type CategoryCode, type Currency, type OrderStatus } from "@repo/contracts";

import { OrderNotPayableError } from "../../../common/errors/errors";

/**
 * The intent to buy. Money movement lives on `Payment` — see ADR-0007.
 *
 * The four snapshot fields are the financial record, not denormalisation for speed. When
 * `RESUME_1M` goes from 25 to 30 TND, this order and the invoice generated from it must still
 * report what the customer was actually shown, or a price edit silently rewrites revenue history.
 * `taxRateBp` is snapshotted for the same reason: a VAT change must not alter an issued invoice.
 */
export interface Order {
  id: string;
  userId: string;
  planId: string;
  categoryId: string;
  categoryCode: CategoryCode;
  status: OrderStatus;

  /** TTC — what the customer pays. Integer minor units (ADR-0006). */
  amountMinor: number;
  currency: Currency;
  /** Basis points. 19% = 1900. */
  taxRateBp: number;
  planCodeSnapshot: string;

  invoiceNumber: string | null;
  paidAt: Date | null;
  idempotencyKey: string | null;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * The state machine.
 *
 * ```
 * PENDING ──► PAID       (a SUCCEEDED payment covers the amount)
 *         ──► FAILED     (the provider declined definitively)
 *         ──► CANCELED   (user or admin, or expired unpaid)
 * PAID    ──► REFUNDED   (a refunding payment recorded)
 * ```
 *
 * A table rather than a chain of `if`s, so the whole rule is readable at once and a new status
 * cannot be added without deciding what it may become.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PAID", "FAILED", "CANCELED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  CANCELED: [],
  REFUNDED: [],
};

export const isPayable = (order: Order): boolean => order.status === "PENDING";

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  ALLOWED_TRANSITIONS[from].includes(to);

/**
 * The gate every status change goes through, wherever it is initiated.
 *
 * Deliberately here rather than in the controller: the admin surface, the checkout flow, the
 * stale-order cron and a future gateway webhook all reach for the same assertion, and a rule
 * enforced at one of four entry points is a rule that will be missed at the other three.
 *
 * `DomainError` carries no HTTP status, so this import does not give the domain layer an opinion
 * about HTTP — the exception filter decides that `ORDER_NOT_PAYABLE` means 409.
 */
export function assertTransition(order: Order, to: OrderStatus): void {
  if (!canTransition(order.status, to)) {
    throw new OrderNotPayableError(order.status);
  }
}

/**
 * Excluding tax, assuming the stored amount is **TTC** (open question 3).
 *
 * Integer arithmetic throughout: a float percentage reintroduces exactly the rounding error that
 * integer minor units exist to avoid. If the answer to open question 3 turns out to be HT, these
 * two functions invert and nothing else in the codebase changes — which is why the assumption is
 * isolated here rather than spread across the invoice renderer.
 */
export const amountExclTax = (order: Pick<Order, "amountMinor" | "taxRateBp">): number =>
  Math.round((order.amountMinor * 10_000) / (10_000 + order.taxRateBp));

/**
 * Derived by subtraction, never by `amountMinor * rate`. Computing both halves independently
 * lets them fail to add up by one millime after rounding; subtracting makes
 * `amountExclTax + totalTax === amountMinor` true by construction, for every price.
 */
export const totalTax = (order: Pick<Order, "amountMinor" | "taxRateBp">): number =>
  order.amountMinor - amountExclTax(order);

/** `REACCHY-2026-00001`. The year is the sequence's year, not necessarily today's. */
export const formatInvoiceNumber = (year: number, sequence: number): string =>
  `REACCHY-${year}-${String(sequence).padStart(5, "0")}`;

/** Matches what `formatInvoiceNumber` produces. Used by the verification script and phase 9. */
export const INVOICE_NUMBER_PATTERN = /^REACCHY-\d{4}-\d{5}$/;

/**
 * How long a `PENDING` order survives before the nightly sweep cancels it.
 *
 * Seven days because the FAQ promises bank transfer, which genuinely takes days to clear. A
 * shorter window would cancel orders that are still legitimately in flight; no window at all
 * leaves them accumulating forever and makes the abandonment metric meaningless.
 */
export const STALE_ORDER_DAYS = 7;
