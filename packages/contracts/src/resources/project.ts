import { z } from "zod";

import { categoryCodeSchema } from "../enums/category";
import { exportFormatSchema, projectStatusSchema } from "../enums/project";
import { idSchema } from "../primitives/id";
import { pageRequestSchema, pageResponseSchema } from "../primitives/pagination";
import { MAX_PAYLOAD_BYTES } from "./payload";

/**
 * Server-computed quota state per project. Present in responses, never in requests — a client
 * that could send `revisionCount` could grant itself revisions.
 */
const projectQuotaFields = {
  /** Versions beyond the first. Creation writes version 1 and consumes no revision. */
  revisionCount: z.number().int().min(0),
  /** `null` = unlimited. */
  revisionLimit: z.number().int().nullable(),
  exportCount: z.number().int().min(0),
  exportLimit: z.number().int().nullable(),
  /**
   * How complete the payload is, 0–100 — computed server-side from the stored payload.
   *
   * A response field rather than something the client derives, for the usual reason: the dashboard bar
   * and the editor's own indicator must agree, and two implementations of "is this CV finished" would
   * eventually disagree. `0` for categories whose payload schema is still permissive.
   */
  completionPercent: z.number().int().min(0).max(100),
};

export const projectListItemSchema = z.object({
  id: z.string(),
  categoryCode: categoryCodeSchema,
  title: z.string(),
  status: projectStatusSchema,
  ...projectQuotaFields,
  /** Absolute URL if published and live; `null` otherwise. */
  publicUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ProjectListItem = z.infer<typeof projectListItemSchema>;

/**
 * `GET /projects/:id`. Carries the payload of the current version so opening a project in a
 * builder is one round trip.
 */
export const projectDetailSchema = projectListItemSchema.extend({
  currentVersion: z.number().int().positive(),
  /** Which payload schema version wrote `data`, so a builder can upgrade it on read. */
  schemaVersion: z.number().int().positive(),
  data: z.record(z.string(), z.unknown()),
  lastOpenedAt: z.iso.datetime().nullable(),
});

export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/**
 * `POST /projects`. `data` is optional so a builder can create an empty project and save into
 * it, which is what "create then edit" needs.
 */
export const createProjectRequestSchema = z
  .object({
    categoryCode: categoryCodeSchema,
    title: z.string().trim().min(1).max(160).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

/**
 * `PATCH /projects/:id`.
 *
 * `expectedVersion` is optimistic concurrency. If the project has moved on, the API returns
 * `409 VERSION_CONFLICT` rather than silently overwriting work from another tab. Worth having
 * because a revision is a *paid, capped* resource — losing one to a lost update is a support
 * ticket, not an inconvenience.
 *
 * Sending `data` consumes a revision; sending only `title` or `status` does not. That
 * distinction lives in the use case, and this schema is what makes it expressible.
 */
export const updateProjectRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    status: z.enum(["DRAFT", "READY"]).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).some((k) => k !== "expectedVersion"), {
    message: "at least one field must be provided",
  });

export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const listProjectsQuerySchema = pageRequestSchema.extend({
  category: categoryCodeSchema.optional(),
  status: projectStatusSchema.optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const listProjectsResponseSchema = pageResponseSchema(projectListItemSchema);

export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;

export const projectIdParamSchema = z.object({ id: idSchema });

// --- Versions ---

export const projectVersionSummarySchema = z.object({
  versionNumber: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  /** True for versionNumber 1: creation is not a revision. */
  isInitial: z.boolean(),
});

export type ProjectVersionSummary = z.infer<typeof projectVersionSummarySchema>;

export const projectVersionsResponseSchema = z.object({
  items: z.array(projectVersionSummarySchema),
  revisionCount: z.number().int().min(0),
  revisionLimit: z.number().int().nullable(),
});

export type ProjectVersionsResponse = z.infer<typeof projectVersionsResponseSchema>;

export const projectVersionDetailSchema = projectVersionSummarySchema.extend({
  data: z.record(z.string(), z.unknown()),
});

export type ProjectVersionDetail = z.infer<typeof projectVersionDetailSchema>;

export const versionNumberParamSchema = z.object({
  id: idSchema,
  versionNumber: z.coerce.number().int().positive(),
});

// --- Exports ---

export const createExportRequestSchema = z
  .object({
    format: exportFormatSchema.default("PDF"),
  })
  .strict();

export type CreateExportRequest = z.infer<typeof createExportRequestSchema>;

export const projectExportSchema = z.object({
  id: z.string(),
  format: exportFormatSchema,
  versionNumber: z.number().int().positive(),
  fileUrl: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  createdAt: z.iso.datetime(),
});

export type ProjectExport = z.infer<typeof projectExportSchema>;

export const projectExportsResponseSchema = z.object({
  items: z.array(projectExportSchema),
  exportCount: z.number().int().min(0),
  exportLimit: z.number().int().nullable(),
});

export type ProjectExportsResponse = z.infer<typeof projectExportsResponseSchema>;

/** Re-exported so the API's payload-size guard and the client agree on one number. */
export { MAX_PAYLOAD_BYTES };
