import { z } from "zod";

/**
 * The complete error catalogue. **`code` is the stable contract** — clients switch on it,
 * never on `detail` (French prose that gets reworded) or on the status alone (several codes
 * share a status and mean different things to the UI).
 *
 * Declared here rather than in the API so the web client gets exhaustiveness checking on a
 * `switch`, and so adding a code forces both sides to be updated together.
 */
export const ERROR_CODES = [
  // 4xx — request
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "TOKEN_INVALID",
  "ACCOUNT_SUSPENDED",
  "FORBIDDEN",
  "NOT_FOUND",

  // 403 — access and entitlement
  "NO_ACTIVE_SUBSCRIPTION",
  "SUBSCRIPTION_EXPIRED",
  "ENTITLEMENT_EXHAUSTED",
  "REVISION_LIMIT_REACHED",
  "EXPORT_LIMIT_REACHED",
  "PUBLICATION_LIMIT_REACHED",
  "CUSTOM_SLUG_NOT_ALLOWED",
  "STORAGE_LIMIT_REACHED",

  // 409 — conflict
  "SLUG_TAKEN",
  "VERSION_CONFLICT",
  "PLAN_INACTIVE",
  "ORDER_NOT_PAYABLE",
  "DUPLICATE_ACTIVE_SUBSCRIPTION",
  "IDEMPOTENCY_CONFLICT",

  // 429 / 5xx
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorCodeSchema = z.enum(ERROR_CODES);

/**
 * The canonical HTTP status per code, so the API cannot map the same code to 403 in one place
 * and 400 in another.
 */
export const ERROR_STATUS = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  TOKEN_INVALID: 401,
  ACCOUNT_SUSPENDED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,

  NO_ACTIVE_SUBSCRIPTION: 403,
  SUBSCRIPTION_EXPIRED: 403,
  ENTITLEMENT_EXHAUSTED: 403,
  REVISION_LIMIT_REACHED: 403,
  EXPORT_LIMIT_REACHED: 403,
  PUBLICATION_LIMIT_REACHED: 403,
  CUSTOM_SLUG_NOT_ALLOWED: 403,
  STORAGE_LIMIT_REACHED: 403,

  SLUG_TAKEN: 409,
  VERSION_CONFLICT: 409,
  PLAN_INACTIVE: 409,
  ORDER_NOT_PAYABLE: 409,
  DUPLICATE_ACTIVE_SUBSCRIPTION: 409,
  IDEMPOTENCY_CONFLICT: 409,

  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const satisfies Record<ErrorCode, number>;

/**
 * The codes that mean "you hit a paywall". Exported as a set so the web app can render a
 * single upgrade card for all of them, and so phase 8 can emit `entitlement.denied` from one
 * predicate instead of enumerating codes at each throw site.
 */
export const ENTITLEMENT_ERROR_CODES = [
  "NO_ACTIVE_SUBSCRIPTION",
  "SUBSCRIPTION_EXPIRED",
  "ENTITLEMENT_EXHAUSTED",
  "REVISION_LIMIT_REACHED",
  "EXPORT_LIMIT_REACHED",
  "PUBLICATION_LIMIT_REACHED",
  "CUSTOM_SLUG_NOT_ALLOWED",
  "STORAGE_LIMIT_REACHED",
] as const satisfies readonly ErrorCode[];

export type EntitlementErrorCode = (typeof ENTITLEMENT_ERROR_CODES)[number];

export const isEntitlementErrorCode = (code: ErrorCode): code is EntitlementErrorCode =>
  (ENTITLEMENT_ERROR_CODES as readonly ErrorCode[]).includes(code);
