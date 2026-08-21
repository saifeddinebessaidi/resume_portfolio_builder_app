import {
  ENTITLEMENT_ERROR_CODES,
  type EntitlementMeta,
  type ErrorCode,
  entitlementMetaSchema,
  problemSchema,
} from "@repo/contracts";

import { messages } from "@/messages/fr";

/**
 * A typed API failure.
 *
 * The whole reason this class exists: a screen can branch on `code` — a stable contract — instead of
 * string-matching `detail`, which is French prose that will be reworded. A client that matches on
 * prose breaks the moment someone improves the copy.
 */
export class ApiProblemError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly detail: string,
    readonly meta: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(detail);
    this.name = "ApiProblemError";
  }

  static async fromResponse(response: Response): Promise<ApiProblemError> {
    const body: unknown = await response.json().catch(() => null);
    const parsed = problemSchema.safeParse(body);

    if (parsed.success) {
      return new ApiProblemError(
        parsed.data.code,
        parsed.data.status,
        parsed.data.detail,
        parsed.data.meta ?? {},
        parsed.data.requestId,
      );
    }

    // A response that is not problem+json at all — a proxy error page, a network appliance. There is
    // nothing trustworthy to read, so it becomes a generic internal error.
    return new ApiProblemError("INTERNAL_ERROR", response.status, messages.errors.generic, {});
  }

  /** The structured numbers behind an entitlement denial, or null when this is not one. */
  get entitlement(): EntitlementMeta | null {
    const parsed = entitlementMetaSchema.safeParse(this.meta);
    return parsed.success ? parsed.data : null;
  }
}

export const isApiProblem = (e: unknown): e is ApiProblemError => e instanceof ApiProblemError;

/**
 * True for every "you hit a paywall" code.
 *
 * Lets a screen render one upgrade card for all of them:
 * `if (isEntitlementError(error)) return <QuotaBlockedCard problem={error} />`
 * — and then read `error.entitlement.limit / .used / .resetsAt` to say
 * "Il vous reste 0 CV sur 3 — renouvellement le 1 septembre" without parsing a sentence.
 */
export const isEntitlementError = (e: unknown): e is ApiProblemError =>
  isApiProblem(e) && (ENTITLEMENT_ERROR_CODES as readonly ErrorCode[]).includes(e.code);

export const isUnauthenticated = (e: unknown): e is ApiProblemError =>
  isApiProblem(e) && (e.code === "UNAUTHENTICATED" || e.code === "TOKEN_INVALID");
