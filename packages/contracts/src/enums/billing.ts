import { z } from "zod";

export const BillingPeriod = {
  MONTHLY: "MONTHLY",
  SEMIANNUAL: "SEMIANNUAL",
  ANNUAL: "ANNUAL",
} as const;

export type BillingPeriod = (typeof BillingPeriod)[keyof typeof BillingPeriod];

export const billingPeriodSchema = z.enum(BillingPeriod);

/**
 * `BillingPeriod` is the marketing label; `Plan.durationDays` is the arithmetic. They are kept
 * separate because 6 months is 180 days here by decision, not by calendar — an explicit day
 * count means `endsAt` has no month-length ambiguity.
 */
export const BILLING_PERIOD_DAYS = {
  MONTHLY: 30,
  SEMIANNUAL: 180,
  ANNUAL: 365,
} as const satisfies Record<BillingPeriod, number>;

export const OrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
  REFUNDED: "REFUNDED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const orderStatusSchema = z.enum(OrderStatus);

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const paymentStatusSchema = z.enum(PaymentStatus);

/**
 * `MANUAL` and `BANK_TRANSFER` are what actually ship (no paid gateway on this project).
 * `STRIPE` and `PAYMEE` exist in the enum so adding an adapter is a `PaymentProvider`
 * implementation and a seed row, not a migration. See ADR-0007.
 */
export const PaymentProviderCode = {
  MANUAL: "MANUAL",
  STRIPE: "STRIPE",
  PAYMEE: "PAYMEE",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;

export type PaymentProviderCode = (typeof PaymentProviderCode)[keyof typeof PaymentProviderCode];

export const paymentProviderCodeSchema = z.enum(PaymentProviderCode);
