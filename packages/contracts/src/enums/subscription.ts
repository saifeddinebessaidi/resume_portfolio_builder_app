import { z } from "zod";

export const SubscriptionStatus = {
  /** An order exists but no money has moved. Grants nothing. */
  PENDING: "PENDING",
  /** The only status that grants access. At most one per (user, category) — partial unique index. */
  ACTIVE: "ACTIVE",
  /** The term lapsed. Projects stay readable; every mutation is denied. */
  EXPIRED: "EXPIRED",
  /** Ended early by the user or an admin, or its order failed. */
  CANCELED: "CANCELED",
} as const;

export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const subscriptionStatusSchema = z.enum(SubscriptionStatus);

/** How a subscription came to exist — kept for reporting and for reconciling free grants. */
export const SubscriptionSource = {
  /** An admin activated it by hand. This is the whole activation path until phase 7. */
  MANUAL_GRANT: "MANUAL_GRANT",
  CHECKOUT: "CHECKOUT",
  MIGRATION: "MIGRATION",
} as const;

export type SubscriptionSource = (typeof SubscriptionSource)[keyof typeof SubscriptionSource];

export const subscriptionSourceSchema = z.enum(SubscriptionSource);
