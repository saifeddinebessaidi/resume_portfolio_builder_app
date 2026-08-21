import { z } from "zod";

import { categoryCodeSchema } from "../enums/category";
import { slugSchema } from "../primitives/id";

/**
 * `POST /projects/:id/publication`.
 *
 * `expiresAt` is deliberately absent: it is computed from the plan's `HOSTING_DAYS`, never
 * supplied by the client. Omitting `slug` auto-generates one; supplying it requires the
 * `CUSTOM_SLUG` entitlement.
 */
export const publishRequestSchema = z
  .object({
    slug: slugSchema.optional(),
    isPublic: z.boolean().default(true),
  })
  .strict();

export type PublishRequest = z.infer<typeof publishRequestSchema>;

export const updatePublicationRequestSchema = z
  .object({
    slug: slugSchema.optional(),
    isPublic: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "at least one field must be provided",
  });

export type UpdatePublicationRequest = z.infer<typeof updatePublicationRequestSchema>;

export const publicationSchema = z.object({
  slug: z.string(),
  publicUrl: z.url(),
  isPublic: z.boolean(),
  publishedAt: z.iso.datetime(),
  /** `null` = never expires. Otherwise the hosting term, from HOSTING_DAYS. */
  expiresAt: z.iso.datetime().nullable(),
  viewCount: z.number().int().min(0),
});

export type Publication = z.infer<typeof publicationSchema>;

/**
 * `GET /public/publications/:slug` — unauthenticated.
 *
 * Carries only what a public page renders. No owner id, no email, no project id, no draft
 * data: this response crosses the auth boundary, so every field in it is a deliberate decision
 * to make that field public.
 */
export const publicPublicationSchema = z.object({
  slug: z.string(),
  title: z.string(),
  categoryCode: categoryCodeSchema,
  /** The published version's payload — never the current draft. */
  data: z.record(z.string(), z.unknown()),
  schemaVersion: z.number().int().positive(),
  publishedAt: z.iso.datetime(),
  ownerName: z.string().nullable(),
});

export type PublicPublication = z.infer<typeof publicPublicationSchema>;

export const slugParamSchema = z.object({ slug: slugSchema });

/** `POST /public/publications/:slug/views`. Body-less; the API derives everything it records. */
export const recordViewResponseSchema = z.object({
  recorded: z.boolean(),
});

export type RecordViewResponse = z.infer<typeof recordViewResponseSchema>;
