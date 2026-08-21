import { z } from "zod";

import { userRoleSchema, userStatusSchema } from "../enums/user";

/**
 * `GET /me`.
 *
 * `role` is included so the web app can show admin navigation, but it is never the authority:
 * every admin endpoint re-checks server-side. A client that hides a button is a courtesy, not
 * a control.
 */
export const meResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  fullName: z.string().nullable(),
  locale: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime().nullable(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

/**
 * `PATCH /me`. A separate schema from the response, deliberately: `role`, `status` and `email`
 * are all present in the response and must be unsettable from a request. Sharing one schema
 * would let a client send `role: "ADMIN"` and rely on the server to remember to strip it.
 *
 * `.strict()` makes an unknown key a validation error rather than silently ignored, so a
 * client typo surfaces during development instead of appearing to work.
 */
export const updateMeRequestSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).nullable().optional(),
    locale: z.enum(["fr", "en", "ar"]).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "at least one field must be provided",
  });

export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

/** The compact user block embedded in the dashboard summary. */
export const userSummarySchema = z.object({
  id: z.string(),
  email: z.email(),
  fullName: z.string().nullable(),
});

export type UserSummary = z.infer<typeof userSummarySchema>;
