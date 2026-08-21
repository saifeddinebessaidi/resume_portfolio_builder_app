import {
  type BillingPeriod,
  type CategoryCode,
  type Currency,
  type EntitlementKey,
  type ResetPeriod,
} from "@repo/contracts";

/**
 * The catalog domain: what is for sale, and what each plan actually grants.
 *
 * Plain interfaces over `@repo/contracts` enums — no framework, no Prisma. A use case can be
 * tested against object literals, and the entitlement engine in step 08 consumes these same shapes
 * whether they came from the database or from a fixture.
 */

export interface ProductCategory {
  id: string;
  code: CategoryCode;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** What a plan grants. `limitValue: null` is unlimited; `0` is explicitly denied. */
export interface PlanEntitlement {
  key: EntitlementKey;
  limitValue: number | null;
  resetPeriod: ResetPeriod;
}

/** A marketing bullet, verbatim from the pricing page. Never enforced — see PlanEntitlement. */
export interface PlanFeature {
  label: string;
  sortOrder: number;
}

export interface Plan {
  id: string;
  code: string;
  categoryId: string;
  categoryCode: CategoryCode;
  name: string;
  billingPeriod: BillingPeriod;
  durationDays: number;
  priceMinor: number;
  currency: Currency;
  badge: string | null;
  isActive: boolean;
  sortOrder: number;
  features: PlanFeature[];
  entitlements: PlanEntitlement[];
}

/**
 * Looks up one entitlement on a plan.
 *
 * Returns `undefined` for "the plan does not mention this key", which the engine must treat as
 * **denied** rather than unlimited — the difference between a missing row and a `null` limit is the
 * difference between "not included in this offer" and "included without a cap". Conflating them
 * would silently grant every unlisted feature.
 */
export const entitlementFor = (plan: Plan, key: EntitlementKey): PlanEntitlement | undefined =>
  plan.entitlements.find((e) => e.key === key);

/** `endsAt` from a start date and the plan's explicit day count. */
export function termEnd(plan: Plan, startsAt: Date): Date {
  const end = new Date(startsAt);
  end.setUTCDate(end.getUTCDate() + plan.durationDays);
  return end;
}
