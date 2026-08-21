import { z } from "zod";

import { categoryCodeSchema } from "../enums/category";
import { projectListItemSchema } from "./project";
import { activeSubscriptionSummarySchema, resolvedEntitlementSchema } from "./subscription";
import { userSummarySchema } from "./user";

/** How many recent projects each category block carries. The full list is GET /projects. */
export const DASHBOARD_PROJECTS_PER_CATEGORY = 5;

export const dashboardCategorySchema = z.object({
  code: categoryCodeSchema,
  name: z.string(),
  slug: z.string(),
  subscription: activeSubscriptionSummarySchema.nullable(),
  entitlements: z.array(resolvedEntitlementSchema),

  /**
   * Computed server-side. The client must never re-derive "is this user allowed to create"
   * from the raw entitlement numbers — that logic would then exist in two places and drift,
   * and the UI would enable a button the API then rejects.
   */
  canCreate: z.boolean(),
  blockedReason: z
    .enum(["NO_ACTIVE_SUBSCRIPTION", "ENTITLEMENT_EXHAUSTED", "SUBSCRIPTION_EXPIRED"])
    .nullable(),

  projects: z.object({
    /** Total across all pages, so the table can say "2 projets" without a second call. */
    total: z.number().int().min(0),
    items: z.array(projectListItemSchema),
  }),
});

export type DashboardCategory = z.infer<typeof dashboardCategorySchema>;

/**
 * `GET /dashboard/summary` — the entire home screen in one round trip.
 *
 * Shaped this way so the dashboard has no request waterfall and no per-category N+1: three
 * tables, three quota badges and three CTAs all render from this single response.
 */
export const dashboardSummarySchema = z.object({
  user: userSummarySchema,
  categories: z.array(dashboardCategorySchema),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
