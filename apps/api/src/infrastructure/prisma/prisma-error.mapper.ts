import { Prisma } from "@prisma/client";
import { type ErrorCode } from "@repo/contracts";

/**
 * Translates a Prisma failure into a business error code.
 *
 * This lives in `infrastructure/prisma/` rather than in the exception filter because knowing
 * what `P2002` means is Prisma knowledge, and the zone rule in eslint.config.mjs is right to
 * keep that out of `common/`. The filter asks this module a question and gets a code back; if
 * Prisma were ever replaced, this is the only file that would change.
 */
export interface MappedPrismaError {
  code: ErrorCode;
  /** French, user-facing. Absent when the code is INTERNAL_ERROR — the filter genericises it. */
  detail?: string;
  meta?: Record<string, unknown>;
}

/** The `target` of a unique violation, normalised to a list of column/constraint names. */
function targetFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const target: unknown = error.meta?.target;

  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === "string");
  if (typeof target === "string") return [target];
  return [];
}

export function isPrismaKnownError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError;
}

export function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): MappedPrismaError {
  switch (error.code) {
    /**
     * Unique constraint violation.
     *
     * Every constraint a *user request* can realistically race into is mapped explicitly,
     * because each one means something different to the UI. Anything else falls through to
     * INTERNAL_ERROR on purpose: an unmapped unique violation means the application skipped a
     * check it should have made, and dressing that up as a tidy 409 would hide a real bug
     * behind a plausible-looking error.
     */
    case "P2002": {
      const fields = targetFields(error);
      const hit = (needle: string) =>
        fields.some((f) => f.toLowerCase().includes(needle.toLowerCase()));

      // The only unique value a user picks directly.
      if (hit("slug")) {
        return {
          code: "SLUG_TAKEN",
          detail: "Ce lien est déjà utilisé. Choisissez-en un autre.",
          meta: { fields },
        };
      }

      // The partial unique index enforcing one ACTIVE subscription per category — reached by a
      // double-submitted grant or two concurrent activations.
      if (hit("subscription_one_active_per_category")) {
        return {
          code: "DUPLICATE_ACTIVE_SUBSCRIPTION",
          detail: "Un abonnement actif existe déjà pour cette catégorie.",
          meta: { fields },
        };
      }

      if (hit("idempotencyKey")) {
        return {
          code: "IDEMPOTENCY_CONFLICT",
          detail: "Cette clé d'idempotence a déjà été utilisée.",
          meta: { fields },
        };
      }

      // (projectId, versionNumber): two saves of the same project raced. From the user's point
      // of view that is exactly a lost update, which is what VERSION_CONFLICT describes.
      if (hit("versionNumber")) {
        return {
          code: "VERSION_CONFLICT",
          detail: "Ce projet a été modifié ailleurs. Rechargez la page.",
          meta: { fields },
        };
      }

      return { code: "INTERNAL_ERROR" };
    }

    // Record not found on an update or delete. Indistinguishable from "not yours", by design.
    case "P2025":
      return { code: "NOT_FOUND", detail: "La ressource demandée est introuvable." };

    // Foreign key violation: a referenced row does not exist.
    case "P2003":
      return { code: "NOT_FOUND", detail: "Une ressource liée est introuvable." };

    /**
     * Transaction timed out or was rolled back by the engine.
     *
     * Deliberately NOT a 500: on Neon's free tier a cold start plus pooler latency can eat a
     * multi-second transaction window, and that is a "try again in a moment" condition, not a
     * defect. Reporting it as an internal error sends whoever reads the log hunting for a bug that
     * is not there. `RATE_LIMITED` carries the right meaning — the system is busy — and its 429 is
     * a status clients already retry on.
     */
    case "P2028":
      return {
        code: "RATE_LIMITED",
        detail: "La base de données a mis trop de temps à répondre. Réessayez dans un instant.",
        meta: { retryAfterSeconds: 2, prismaCode: error.code },
      };

    // A CHECK constraint rejected the write — e.g. a negative usage counter. That is a bug in
    // the arithmetic, not something a caller can fix.
    case "P2010":
    default:
      return { code: "INTERNAL_ERROR" };
  }
}
