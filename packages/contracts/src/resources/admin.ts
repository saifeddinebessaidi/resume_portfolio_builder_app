import { z } from "zod";

import { categoryCodeSchema } from "../enums/category";
import { orderStatusSchema, paymentProviderCodeSchema } from "../enums/billing";
import { entitlementKeySchema } from "../enums/entitlement";
import { accessFeatureSchema, userRoleSchema, userStatusSchema } from "../enums/user";
import { moneySchema } from "../primitives/money";
import { pageRequestSchema, pageResponseSchema } from "../primitives/pagination";
import { planSchema } from "./catalog";
import { orderSchema, paymentSchema } from "./order";
import { categoryEntitlementsSchema, subscriptionSchema } from "./subscription";
import { meResponseSchema, userSummarySchema } from "./user";

/**
 * Everything under `/admin/*`. Every endpoint here is `@Roles("ADMIN")` server-side; the web
 * app hiding the admin area from non-admins is a courtesy, not a control.
 */

/** Every admin mutation records why. Required, so an override is explicable a year later. */
const reasonSchema = z.string().trim().min(1).max(500);

// --- Users ---------------------------------------------------------------------------

export const adminListUsersQuerySchema = pageRequestSchema.extend({
  /** Case-insensitive substring of email or full name. */
  q: z.string().trim().min(1).max(120).optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
});

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;

export const adminUserListItemSchema = meResponseSchema.extend({
  /** Categories with an ACTIVE, unexpired subscription right now. */
  activeCategories: z.array(categoryCodeSchema),
  /** Features an admin has switched off. Empty for almost everyone. */
  disabledFeatures: z.array(accessFeatureSchema),
});

export type AdminUserListItem = z.infer<typeof adminUserListItemSchema>;

export const adminListUsersResponseSchema = pageResponseSchema(adminUserListItemSchema);

export type AdminListUsersResponse = z.infer<typeof adminListUsersResponseSchema>;

export const accessOverrideSchema = z.object({
  feature: accessFeatureSchema,
  enabled: z.boolean(),
  reason: z.string().nullable(),
  updatedBy: userSummarySchema,
  updatedAt: z.iso.datetime(),
});

export type AccessOverride = z.infer<typeof accessOverrideSchema>;

export const entitlementOverrideSchema = z.object({
  categoryCode: categoryCodeSchema,
  key: entitlementKeySchema,
  /** Same semantics as a plan's limit: `null` = unlimited, `0` = denied. */
  limitValue: z.number().int().nullable(),
  reason: z.string().nullable(),
  updatedBy: userSummarySchema,
  updatedAt: z.iso.datetime(),
});

export type EntitlementOverride = z.infer<typeof entitlementOverrideSchema>;

export const adminOrderSchema = orderSchema.extend({
  user: userSummarySchema,
  payments: z.array(paymentSchema),
});

export type AdminOrder = z.infer<typeof adminOrderSchema>;

export const adminUserDetailSchema = z.object({
  user: meResponseSchema,
  subscriptions: z.array(subscriptionSchema),
  orders: z.array(adminOrderSchema),
  /** Already has the overrides applied — exactly what enforcement sees. */
  entitlements: z.array(categoryEntitlementsSchema),
  accessOverrides: z.array(accessOverrideSchema),
  entitlementOverrides: z.array(entitlementOverrideSchema),
});

export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminUpdateUserRequestSchema = z
  .object({
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    reason: reasonSchema,
  })
  .strict()
  .refine((body) => body.role !== undefined || body.status !== undefined, {
    message: "role or status must be provided",
  });

export type AdminUpdateUserRequest = z.infer<typeof adminUpdateUserRequestSchema>;

export const adminUserIdParamSchema = z.object({ id: z.string().min(1) });

export const adminAccessParamSchema = z.object({
  id: z.string().min(1),
  feature: accessFeatureSchema,
});

export const setAccessOverrideRequestSchema = z
  .object({
    enabled: z.boolean(),
    reason: reasonSchema,
  })
  .strict();

export type SetAccessOverrideRequest = z.infer<typeof setAccessOverrideRequestSchema>;

export const setEntitlementOverrideRequestSchema = z
  .object({
    categoryCode: categoryCodeSchema,
    key: entitlementKeySchema,
    limitValue: z.number().int().min(0).max(1_000_000).nullable(),
    reason: reasonSchema,
  })
  .strict();

export type SetEntitlementOverrideRequest = z.infer<typeof setEntitlementOverrideRequestSchema>;

export const adminEntitlementOverrideParamSchema = z.object({
  id: z.string().min(1),
  category: categoryCodeSchema,
  key: entitlementKeySchema,
});

/** Body of the DELETE endpoints — a removal is a mutation like any other and gets a reason. */
export const adminReasonRequestSchema = z.object({ reason: reasonSchema }).strict();

export type AdminReasonRequest = z.infer<typeof adminReasonRequestSchema>;

// --- Subscriptions -------------------------------------------------------------------

export const extendSubscriptionRequestSchema = z
  .object({
    days: z.number().int().min(1).max(3650),
    reason: reasonSchema,
  })
  .strict();

export type ExtendSubscriptionRequest = z.infer<typeof extendSubscriptionRequestSchema>;

// --- Orders --------------------------------------------------------------------------

export const adminListOrdersQuerySchema = pageRequestSchema.extend({
  status: orderStatusSchema.optional(),
  provider: paymentProviderCodeSchema.optional(),
  userId: z.string().min(1).optional(),
});

export type AdminListOrdersQuery = z.infer<typeof adminListOrdersQuerySchema>;

export const adminListOrdersResponseSchema = pageResponseSchema(adminOrderSchema);

export type AdminListOrdersResponse = z.infer<typeof adminListOrdersResponseSchema>;

export const markOrderPaidRequestSchema = z
  .object({
    /** Bank transfer reference, receipt number… whatever ties this to the money. */
    providerRef: z.string().trim().min(1).max(255).optional(),
    reason: reasonSchema,
  })
  .strict();

export type MarkOrderPaidRequest = z.infer<typeof markOrderPaidRequestSchema>;

// --- Plans (read-only in v1) ----------------------------------------------------------

export const adminPlanSchema = planSchema.extend({
  isActive: z.boolean(),
  activeSubscriptions: z.number().int(),
});

export type AdminPlan = z.infer<typeof adminPlanSchema>;

export const adminPlansResponseSchema = z.object({ plans: z.array(adminPlanSchema) });

export type AdminPlansResponse = z.infer<typeof adminPlansResponseSchema>;

// --- Metrics -------------------------------------------------------------------------

export const adminMetricsOverviewSchema = z.object({
  users: z.object({
    total: z.number().int(),
    new7d: z.number().int(),
    new30d: z.number().int(),
    suspended: z.number().int(),
  }),
  activeSubscriptions: z.array(
    z.object({ categoryCode: categoryCodeSchema, count: z.number().int() }),
  ),
  /** One entry per currency — amounts in different currencies are never summed. */
  revenue: z.object({
    last30d: z.array(moneySchema),
    allTime: z.array(moneySchema),
  }),
  pendingOrders: z.number().int(),
});

export type AdminMetricsOverview = z.infer<typeof adminMetricsOverviewSchema>;
