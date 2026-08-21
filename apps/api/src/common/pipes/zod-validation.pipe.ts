import { Injectable, type PipeTransform } from "@nestjs/common";
import { type ValidationIssue } from "@repo/contracts";
import { type ZodType } from "zod";

import { ValidationFailedError } from "../errors/errors";

/**
 * Validates a request part against a schema from `@repo/contracts`.
 *
 * Used per-endpoint — `@Body(new ZodValidationPipe(createProjectRequestSchema))` — rather than
 * bound globally, because there is no single schema that could apply to every route. This is
 * the "one schema, reused" requirement satisfied literally: the same object validates the
 * request here and the form in phase 3.
 *
 * Returns the PARSED value, not the input: Zod applies defaults and coercions (a `limit` query
 * string becomes a number), so discarding the result would throw that work away.
 */
@Injectable()
export class ZodValidationPipe<TOut> implements PipeTransform<unknown, TOut> {
  constructor(private readonly schema: ZodType<TOut>) {}

  transform(value: unknown): TOut {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
        // Dotted path so a nested failure points at the exact input, e.g.
        // "data.experience.0.company". Empty for a root-level issue.
        path: issue.path.map(String).join("."),
        message: issue.message,
        code: issue.code,
      }));

      // 422 with a field-level breakdown, so the web form attaches messages to the right
      // inputs instead of showing one banner.
      throw new ValidationFailedError(issues);
    }

    return result.data;
  }
}

/** Reads slightly better at call sites: `@Body(zodPipe(schema))`. */
export const zodPipe = <T>(schema: ZodType<T>): ZodValidationPipe<T> =>
  new ZodValidationPipe(schema);
