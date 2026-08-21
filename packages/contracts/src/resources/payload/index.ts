import { type z } from "zod";

import { CategoryCode, type CategoryCode as CategoryCodeType } from "../../enums/category";
import { portfolioCompletion, portfolioPayloadSchema } from "./portfolio";
import { resumeCompletion, resumePayloadSchema } from "./resume";

/**
 * Which version of a category's payload schema is current.
 *
 * Every `ProjectVersion` row stores the version that wrote it, so when a builder's state shape
 * changes in phase 4/5/6 old rows stay readable and an upgrade function can be applied lazily
 * on read instead of in a destructive migration.
 */
export const PAYLOAD_SCHEMA_VERSIONS = {
  RESUME: 1,
  PORTFOLIO: 1,
  PORTFOLIO_PRO: 1,
} as const satisfies Record<CategoryCodeType, number>;

/** Guards against a builder payload large enough to make a row unreadable or a request hang. */
export const MAX_PAYLOAD_BYTES = 1_000_000;

/**
 * The per-category payload registry.
 *
 * **RESUME is now the real schema**, ported from the builder repository (phase 4 step 02). PORTFOLIO
 * and PORTFOLIO_PRO stay permissive until their repositories arrive: `z.record(z.string(),
 * z.unknown())` accepts any JSON object but rejects a string, an array or a null, which is enough to
 * keep the column's shape sane in the meantime.
 *
 * Replacing one entry required **no change anywhere downstream** — not in `CreateProjectUseCase`, not
 * in `UpdateProjectUseCase`, not in the repository, not in the dashboard. That was the test of whether
 * the single-`Project`-table decision (ADR-0004) was right, and it passed.
 */
export const payloadSchemas = {
  [CategoryCode.RESUME]: resumePayloadSchema,
  /**
   * **PORTFOLIO is now the real schema**, ported from the audited repository (phase 5 step 02).
   *
   * `PORTFOLIO_PRO` shares it. The two are priced identically with byte-identical features and open
   * question 2 is still unanswered, so giving Pro its own schema now would be inventing the difference
   * rather than recording it. When Pro is defined it gets its own entry, and nothing else changes —
   * which is the same property that made swapping RESUME in a one-line edit.
   */
  [CategoryCode.PORTFOLIO]: portfolioPayloadSchema,
  [CategoryCode.PORTFOLIO_PRO]: portfolioPayloadSchema,
} as const satisfies Record<CategoryCodeType, z.ZodType<Record<string, unknown>>>;

export type ProjectPayload = Record<string, unknown>;

export const payloadSchemaFor = (code: CategoryCodeType): z.ZodType<ProjectPayload> =>
  payloadSchemas[code];

export const payloadVersionFor = (code: CategoryCodeType): number => PAYLOAD_SCHEMA_VERSIONS[code];

/**
 * How complete a project's payload is, 0–100, per category.
 *
 * A registry lookup like `payloadSchemaFor`, so the API computes progress without switching on the
 * category — the same reason ADR-0004 held when RESUME's schema landed.
 *
 * PORTFOLIO and PORTFOLIO_PRO return **0** rather than a guess: their payload shapes are still
 * permissive `Record<string, unknown>`, so there are no known fields to score. A fabricated percentage
 * would be worse than an honest "not measured yet" — and their builders arrive in phases 5–6, each
 * bringing a real completion function with its schema.
 */
export function completionPercentFor(code: CategoryCodeType, data: ProjectPayload): number {
  // Parsed, not cast: an older stored payload may predate fields the scorer reads, and the schema's
  // defaults fill them in rather than the scorer throwing on `undefined`.
  if (code === CategoryCode.RESUME) {
    const parsed = resumePayloadSchema.safeParse(data);
    return parsed.success ? resumeCompletion(parsed.data).percent : 0;
  }

  const parsed = portfolioPayloadSchema.safeParse(data);
  return parsed.success ? portfolioCompletion(parsed.data).percent : 0;
}

export * from "./portfolio";
export * from "./resume";
