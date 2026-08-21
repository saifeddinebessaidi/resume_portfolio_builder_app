import { z } from "zod";

import { categoryCodeSchema } from "../enums/category";
import { entitlementKeySchema, resetPeriodSchema } from "../enums/entitlement";
import { subscriptionSourceSchema, subscriptionStatusSchema } from "../enums/subscription";
import { moneySchema } from "../primitives/money";

/**
 * A plan's limit combined with the holder's usage. This is the shape the guards compute and
 * the shape the client reads to grey out a button — the same numbers, so the UI cannot
 * disagree with the enforcement.
 */
export const resolvedEntitlementSchema = z.object({
  key: entitlementKeySchema,
  /** `null` = unlimited. */
  limit: z.number().int().nullable(),
  /** `null` for keys not metered by a period counter — per-project caps are counted per project. */
  used: z.number().int().nullable(),
  /** `null` when `limit` is null (unlimited) or `used` is null (not period-metered). */
  remaining: z.number().int().nullable(),
  resetPeriod: resetPeriodSchema,
  /** When `used` returns to zero. `null` for `NONE`. */
  resetsAt: z.iso.datetime().nullable(),
});

export type ResolvedEntitlement = z.infer<typeof resolvedEntitlementSchema>;

export const subscriptionSchema = z.object({
  id: z.string(),
  categoryCode: categoryCodeSchema,
  status: subscriptionStatusSchema,
  /**
   * The snapshot, not a join to the live plan. A price edit must never rewrite what a past
   * holder actually paid.
   */
  planCode: z.string(),
  planName: z.string(),
  price: moneySchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  canceledAt: z.iso.datetime().nullable(),
  autoRenew: z.boolean(),
  source: subscriptionSourceSchema,
  createdAt: z.iso.datetime(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const subscriptionsResponseSchema = z.object({
  subscriptions: z.array(subscriptionSchema),
});

export type SubscriptionsResponse = z.infer<typeof subscriptionsResponseSchema>;

/** The compact block embedded per category in the dashboard summary. */
export const activeSubscriptionSummarySchema = z.object({
  status: subscriptionStatusSchema,
  planCode: z.string(),
  planName: z.string(),
  endsAt: z.iso.datetime(),
});

export type ActiveSubscriptionSummary = z.infer<typeof activeSubscriptionSummarySchema>;

export const categoryEntitlementsSchema = z.object({
  categoryCode: categoryCodeSchema,
  subscription: activeSubscriptionSummarySchema.nullable(),
  entitlements: z.array(resolvedEntitlementSchema),
  /** Computed server-side. The client must never re-derive this from raw numbers. */
  canCreate: z.boolean(),
  blockedReason: z
    .enum(["NO_ACTIVE_SUBSCRIPTION", "ENTITLEMENT_EXHAUSTED", "SUBSCRIPTION_EXPIRED"])
    .nullable(),
});

export type CategoryEntitlements = z.infer<typeof categoryEntitlementsSchema>;

/**
 * `GET /subscriptions/entitlements`. Returns the same resolved shape the guards use, so a
 * client can grey out a button before the user clicks. A convenience, never the authority —
 * the server re-checks on every mutation.
 */
export const entitlementsResponseSchema = z.object({
  categories: z.array(categoryEntitlementsSchema),
});

export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;

/**
 * `POST /admin/subscriptions/grant` — the activation path for all of phase 2, and the manual
 * provider's activation path in phase 7.
 */
export const grantSubscriptionRequestSchema = z
  .object({
    userId: z.string().min(1),
    planCode: z.string().min(1),
    /** Defaults to now. Supplied only to backdate a grant during reconciliation. */
    startsAt: z.iso.datetime().optional(),
    /** Written to the AuditLog row. Required: a free grant must be explicable later. */
    note: z.string().trim().min(1).max(500),
  })
  .strict();

export type GrantSubscriptionRequest = z.infer<typeof grantSubscriptionRequestSchema>;
