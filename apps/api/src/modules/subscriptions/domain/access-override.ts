import {
  type AccessFeature,
  type CategoryCode,
  type EntitlementKey,
  PERIOD_METERED_KEYS,
  type ResetPeriod,
} from "@repo/contracts";

import { type PlanEntitlement } from "../../catalog/domain/catalog.entity";

export const ACCESS_OVERRIDES = Symbol("ACCESS_OVERRIDES");

/** One admin-set replacement for a plan limit. `null` = unlimited, `0` = denied — as on a plan. */
export interface LimitOverride {
  key: EntitlementKey;
  limitValue: number | null;
}

/**
 * Reads the per-user exceptions an admin has set. A port so the entitlement engine can apply them
 * without importing Prisma; the admin module owns the writes.
 *
 * Neither method takes a transaction, deliberately: like the catalog lookup in
 * `ConsumeEntitlementService.resolve`, these are read before `uow.run` so they never compete with a
 * transaction for the single pooled connection.
 */
export interface AccessOverrideReader {
  disabledFeatures(userId: string): Promise<AccessFeature[]>;
  limitOverridesFor(userId: string, categoryId: string): Promise<LimitOverride[]>;
}

/**
 * The section switch for a category. The category codes and their AccessFeature twins share names
 * on purpose, but the mapping is spelled out so renaming one cannot silently unlink them.
 */
export const featureForCategory = (category: CategoryCode): AccessFeature => {
  switch (category) {
    case "RESUME":
      return "RESUME";
    case "PORTFOLIO":
      return "PORTFOLIO";
    case "PORTFOLIO_PRO":
      return "PORTFOLIO_PRO";
  }
};

/**
 * The reset period given to a key the plan does not declare but an admin override adds. Period-metered
 * keys get `TERM` (one allowance for the subscription), everything else is counted on the resource.
 */
const defaultResetPeriod = (key: EntitlementKey): ResetPeriod =>
  (PERIOD_METERED_KEYS as readonly EntitlementKey[]).includes(key) ? "TERM" : "NONE";

/**
 * The plan's limits with the admin's overrides laid on top. An override replaces `limitValue` and
 * keeps the plan's reset period; one for a key the plan never declared adds it.
 *
 * Pure, so the one rule both the read path and the spend path depend on has one implementation.
 */
export function applyLimitOverrides(
  planEntitlements: readonly PlanEntitlement[],
  overrides: readonly LimitOverride[],
): PlanEntitlement[] {
  if (overrides.length === 0) return [...planEntitlements];

  const byKey = new Map(overrides.map((o) => [o.key, o.limitValue]));

  const merged = planEntitlements.map((definition) =>
    byKey.has(definition.key)
      ? { ...definition, limitValue: byKey.get(definition.key) ?? null }
      : definition,
  );

  for (const override of overrides) {
    if (!planEntitlements.some((d) => d.key === override.key)) {
      merged.push({
        key: override.key,
        limitValue: override.limitValue,
        resetPeriod: defaultResetPeriod(override.key),
      });
    }
  }

  return merged;
}
