import { z } from "zod";

import { billingPeriodSchema } from "../enums/billing";
import { categoryCodeSchema } from "../enums/category";
import { entitlementKeySchema, resetPeriodSchema } from "../enums/entitlement";
import { moneySchema } from "../primitives/money";

export const categorySchema = z.object({
  code: categoryCodeSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
});

export type Category = z.infer<typeof categorySchema>;

export const categoriesResponseSchema = z.object({
  categories: z.array(categorySchema),
});

export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;

/**
 * An enforced limit. Note this is the *plan's* declaration — what the plan grants — with no
 * usage in it. Resolved state (limit + used + remaining) is a different shape, in
 * subscription.ts, because a plan has no usage until someone holds a subscription to it.
 */
export const planEntitlementSchema = z.object({
  key: entitlementKeySchema,
  /** `null` = unlimited. `0` = explicitly denied. The difference matters. */
  limitValue: z.number().int().nullable(),
  resetPeriod: resetPeriodSchema,
});

export type PlanEntitlement = z.infer<typeof planEntitlementSchema>;

/**
 * A marketing bullet, verbatim from the pricing page.
 *
 * Separate from `planEntitlementSchema` on purpose: the live pricing page promises
 * "Hébergement et mises à jour inclus" while capping revisions at 1/3/6. Marketing copy and
 * enforced limits genuinely differ here, and keeping them apart makes the divergence visible
 * instead of forcing us to either lie to the customer or break the copy.
 */
export const planFeatureSchema = z.object({
  label: z.string(),
  sortOrder: z.number().int(),
});

export type PlanFeature = z.infer<typeof planFeatureSchema>;

export const planSchema = z.object({
  code: z.string(),
  name: z.string(),
  categoryCode: categoryCodeSchema,
  billingPeriod: billingPeriodSchema,
  durationDays: z.number().int().positive(),
  price: moneySchema,
  /** "Best Value", "Pro", "-10%" — the landing page's badge, not an enum. */
  badge: z.string().nullable(),
  sortOrder: z.number().int(),
  features: z.array(planFeatureSchema),
  entitlements: z.array(planEntitlementSchema),
});

export type Plan = z.infer<typeof planSchema>;

export const plansResponseSchema = z.object({
  category: categorySchema,
  plans: z.array(planSchema),
});

export type PlansResponse = z.infer<typeof plansResponseSchema>;

export const categoryCodeParamSchema = z.object({
  code: categoryCodeSchema,
});
