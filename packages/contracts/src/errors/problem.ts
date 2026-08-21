import { z } from "zod";

import { entitlementKeySchema } from "../enums/entitlement";
import { errorCodeSchema } from "./error-codes";

/** Where `type` points. Documentation, not a fetchable resource. */
export const PROBLEM_TYPE_BASE = "https://docs.reacchy.com/errors";

export const problemTypeFor = (code: string): string => `${PROBLEM_TYPE_BASE}/${code}`;

/** One field-level failure from a Zod parse, flattened for the wire. */
export const validationIssueSchema = z.object({
  /** Dotted path, e.g. `data.experience.0.company`. Empty string for a root-level issue. */
  path: z.string(),
  message: z.string(),
  code: z.string().optional(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/**
 * The `meta` object for an entitlement denial. This is the whole reason the error contract has
 * a `meta` at all: it lets the UI render "Il vous reste 0 CV sur 3 — renouvellement le 1 août"
 * from numbers instead of parsing the French in `detail`.
 */
export const entitlementMetaSchema = z.object({
  entitlementKey: entitlementKeySchema,
  /** `null` means unlimited — which should never accompany an exhausted error, but the wire allows it. */
  limit: z.number().int().nullable(),
  used: z.number().int(),
  /** `null` for a limit that never refills (per-project caps). */
  resetsAt: z.iso.datetime().nullable(),
  categoryCode: z.string().optional(),
});

export type EntitlementMeta = z.infer<typeof entitlementMetaSchema>;

/**
 * RFC 7807 `application/problem+json`. Every non-2xx body in the API has this shape.
 *
 * `meta` is a permissive record rather than a discriminated union on `code`: a union would
 * force the client to narrow before reading `requestId`, and new metadata could not be added
 * without breaking older clients. Consumers that need the structured form parse `meta` with
 * `entitlementMetaSchema` after switching on `code`.
 */
export const problemSchema = z.object({
  type: z.string(),
  /** Short, stable, human-readable. Safe to show; `detail` is the specific message. */
  title: z.string(),
  status: z.number().int().min(400).max(599),
  code: errorCodeSchema,
  /** French, user-facing, and explicitly NOT parseable — it gets reworded. */
  detail: z.string(),
  /** The path that failed, e.g. `/api/v1/projects`. */
  instance: z.string(),
  /** Correlates to the server logs. Surfaced in the UI on 5xx so a user can quote it. */
  requestId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type Problem = z.infer<typeof problemSchema>;

/** For `VALIDATION_FAILED`, `meta.issues` carries the field-level breakdown. */
export const validationProblemMetaSchema = z.object({
  issues: z.array(validationIssueSchema),
});

export type ValidationProblemMeta = z.infer<typeof validationProblemMetaSchema>;
