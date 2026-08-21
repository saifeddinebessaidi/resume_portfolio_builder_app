import { z } from "zod";

/**
 * The event taxonomy: `domain.action`, past tense, lower snake case.
 *
 * Declared as constants so a typo is a compile error rather than a silently orphaned event
 * name that shows up as a gap in a chart six months later.
 */
export const ANALYTICS_EVENTS = {
  // --- Identity ---
  USER_PROVISIONED: "user.provisioned",
  USER_SIGNED_IN: "user.signed_in",
  USER_PROFILE_UPDATED: "user.profile_updated",
  USER_SUSPENDED: "user.suspended",
  USER_REINSTATED: "user.reinstated",

  // --- Catalog & commerce ---
  PLAN_VIEWED: "plan.viewed",
  ORDER_CREATED: "order.created",
  ORDER_PAID: "order.paid",
  ORDER_FAILED: "order.failed",
  ORDER_CANCELED: "order.canceled",
  SUBSCRIPTION_ACTIVATED: "subscription.activated",
  SUBSCRIPTION_EXPIRED: "subscription.expired",
  SUBSCRIPTION_CANCELED: "subscription.canceled",
  SUBSCRIPTION_SWITCHED: "subscription.switched",

  // --- Work ---
  PROJECT_CREATED: "project.created",
  PROJECT_OPENED: "project.opened",
  PROJECT_SAVED: "project.saved",
  PROJECT_DELETED: "project.deleted",
  PROJECT_EXPORTED: "project.exported",
  PROJECT_PUBLISHED: "project.published",
  PROJECT_UNPUBLISHED: "project.unpublished",
  PUBLICATION_VIEWED: "publication.viewed",
  ASSET_UPLOADED: "asset.uploaded",

  // --- Friction: the conversion signal, and the most valuable events here ---
  /** Any entitlement denial. Tells you exactly which quota caused a paywall hit. */
  ENTITLEMENT_DENIED: "entitlement.denied",
  /** An action attempted with no active subscription for that category. */
  SUBSCRIPTION_REQUIRED: "subscription.required",
  /** The UI showed a "1 remaining" warning. */
  QUOTA_WARNING_SHOWN: "quota.warning_shown",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const ANALYTICS_EVENT_NAMES = Object.values(ANALYTICS_EVENTS);

export const analyticsEventNameSchema = z.enum(
  ANALYTICS_EVENT_NAMES as [AnalyticsEventName, ...AnalyticsEventName[]],
);

/**
 * Events a browser is allowed to POST to `/events`.
 *
 * A deliberate allow-list, not the full taxonomy: server-authoritative events
 * (`order.paid`, `subscription.activated`, `entitlement.denied`) must never be forgeable by a
 * client, or the funnel can be poisoned by anyone with a fetch call.
 */
export const CLIENT_EMITTABLE_EVENTS = [
  ANALYTICS_EVENTS.PROJECT_OPENED,
  ANALYTICS_EVENTS.PLAN_VIEWED,
  ANALYTICS_EVENTS.QUOTA_WARNING_SHOWN,
] as const satisfies readonly AnalyticsEventName[];

export const clientEventNameSchema = z.enum(
  CLIENT_EMITTABLE_EVENTS as unknown as [AnalyticsEventName, ...AnalyticsEventName[]],
);

/** Max events per `POST /events` call, matching the documented rate limit. */
export const MAX_CLIENT_EVENT_BATCH = 50;

export const clientEventSchema = z.object({
  name: clientEventNameSchema,
  occurredAt: z.iso.datetime().optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
});

export const clientEventBatchSchema = z.object({
  events: z.array(clientEventSchema).min(1).max(MAX_CLIENT_EVENT_BATCH),
  sessionId: z.string().max(128).optional(),
});

export type ClientEventBatch = z.infer<typeof clientEventBatchSchema>;
