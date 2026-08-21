import { type EntitlementKey, type ResetPeriod } from "@repo/contracts";

/**
 * A plan's limit combined with the holder's usage — the same numbers the guard checks and the UI
 * renders, so the two cannot disagree.
 */
export interface ResolvedEntitlement {
  key: EntitlementKey;
  /** `null` = unlimited. */
  limit: number | null;
  /** `null` for keys not metered by a period counter (per-resource limits). */
  used: number | null;
  /** `null` when unlimited or not period-metered. */
  remaining: number | null;
  resetPeriod: ResetPeriod;
  /** When `used` returns to zero. `null` for `NONE`. */
  resetsAt: Date | null;
}

export interface EntitlementDefinition {
  key: EntitlementKey;
  limitValue: number | null;
  resetPeriod: ResetPeriod;
}

/**
 * Combines a definition with a usage count into the shape everything reads.
 *
 * `remaining` is computed here, once, rather than at each call site — including the clamp at zero, so
 * an over-consumed counter (possible if a limit was lowered after the fact) reports 0 rather than a
 * negative number that a UI would render as "-2 restants".
 */
export function resolveEntitlement(
  definition: EntitlementDefinition,
  used: number | null,
  resetsAt: Date | null,
): ResolvedEntitlement {
  const limit = definition.limitValue;

  const remaining = limit === null || used === null ? null : Math.max(0, limit - used);

  return {
    key: definition.key,
    limit,
    used,
    remaining,
    resetPeriod: definition.resetPeriod,
    resetsAt,
  };
}

/**
 * Whether one more unit may be spent.
 *
 * `limit === null` is unlimited; `limit === 0` is explicitly denied. Both are real states in the
 * schema and the difference matters: a plan that omits a key entirely is handled elsewhere (deny by
 * default), while `0` is a deliberate "this offer does not include it".
 */
export function hasHeadroom(entitlement: ResolvedEntitlement): boolean {
  if (entitlement.limit === null) return true;
  if (entitlement.limit === 0) return false;
  if (entitlement.used === null) return true;
  return entitlement.used < entitlement.limit;
}
