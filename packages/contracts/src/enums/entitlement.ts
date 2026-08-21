import { z } from "zod";

/**
 * Everything a plan can limit.
 *
 * Adding a new kind of limit is one value here, one Prisma enum value, and one lookup in the
 * relevant use case — never an `if (plan.code === …)`. See ADR-0005.
 */
export const EntitlementKey = {
  /** How many projects may be created in the reset period. */
  PROJECT_CREATE_QUOTA: "PROJECT_CREATE_QUOTA",
  /** How many times one project may be revised. Counted on the project, not a counter row. */
  REVISION_PER_PROJECT: "REVISION_PER_PROJECT",
  /** How many times one project may be exported/downloaded. */
  EXPORT_PER_PROJECT: "EXPORT_PER_PROJECT",
  /** How many projects may hold a live public link at once. */
  PUBLICATION_SLOT: "PUBLICATION_SLOT",
  /** A boolean flag expressed as a limit: >= 1 means the plan allows a user-chosen slug. */
  CUSTOM_SLUG: "CUSTOM_SLUG",
  /** Days a published link stays live; sets ProjectPublication.expiresAt at publish time. */
  HOSTING_DAYS: "HOSTING_DAYS",
  /** Total asset storage in megabytes, summed over ProjectAsset.sizeBytes. */
  ASSET_STORAGE_MB: "ASSET_STORAGE_MB",
} as const;

export type EntitlementKey = (typeof EntitlementKey)[keyof typeof EntitlementKey];

export const entitlementKeySchema = z.enum(EntitlementKey);

export const ENTITLEMENT_KEYS = Object.values(EntitlementKey);

/**
 * How a limit refills.
 *
 * `NONE` is not "no limit" — it means the limit is not metered by a period counter at all.
 * Per-project limits (revisions, exports) are counted on the project itself, so they use
 * `NONE`. Mixing this up is the easiest way to build a quota that silently never resets.
 */
export const ResetPeriod = {
  /** Not period-metered. Counted per project, or a permanent flag. */
  NONE: "NONE",
  /** Refills at the first instant of each calendar month. */
  MONTHLY: "MONTHLY",
  /** One allowance for the whole subscription term; periodStart = subscription.startsAt. */
  TERM: "TERM",
} as const;

export type ResetPeriod = (typeof ResetPeriod)[keyof typeof ResetPeriod];

export const resetPeriodSchema = z.enum(ResetPeriod);

/**
 * Which keys are metered by a `UsageCounter` row, and which are answered by counting the
 * owning rows. The entitlement engine branches on this, so it lives next to the enum rather
 * than being re-derived at each call site.
 */
export const PERIOD_METERED_KEYS = [
  EntitlementKey.PROJECT_CREATE_QUOTA,
  EntitlementKey.PUBLICATION_SLOT,
] as const satisfies readonly EntitlementKey[];
