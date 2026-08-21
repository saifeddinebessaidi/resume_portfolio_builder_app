import { type CategoryCode } from "@repo/contracts";

/**
 * One factory for every cache key.
 *
 * Centralised because the invalidation rule depends on keys being predictable: a mutation that spends
 * quota must invalidate the dashboard, and it can only do that if it knows the dashboard's key without
 * guessing.
 */
export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard", "summary"] as const,
  entitlements: ["subscriptions", "entitlements"] as const,
  subscriptions: ["subscriptions", "list"] as const,
  projects: (category?: CategoryCode) => ["projects", category ?? "all"] as const,
  project: (id: string) => ["projects", "detail", id] as const,
} as const;
