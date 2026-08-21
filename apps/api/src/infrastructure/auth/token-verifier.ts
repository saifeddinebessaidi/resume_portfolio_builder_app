/**
 * The authentication port.
 *
 * Interface segregation, concretely: this exposes exactly one method. A use case that needs to
 * know who is calling does not get a whole identity-provider SDK surface, and swapping providers
 * cannot ripple past this file.
 *
 * Two adapters implement it — `LocalJwtVerifier` for development and `SupabaseJwtVerifier` for
 * production. Which one is bound is a configuration decision made in `auth.module.ts`; no guard,
 * controller or use case knows the difference.
 */

/** Injection token. A `Symbol` so it cannot collide with a class name. */
export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");

/**
 * What a verified token tells us, and nothing more.
 *
 * Deliberately minimal. `externalAuthId` is the provider's subject claim and is the only
 * identity anchor we trust; `email` is copied so the local mirror stays fresh. Note what is
 * absent: **no role, no permissions, no arbitrary claims.** Token metadata is
 * user-influenceable, so admitting a `role` field here would create a path from a claim to a
 * privilege — the exact bug the reference project's signup trigger had to defend against.
 */
export interface VerifiedIdentity {
  externalAuthId: string;
  email: string;
}

export interface TokenVerifier {
  /**
   * Resolves to the identity, or throws `TokenInvalidError`.
   *
   * Throwing rather than returning null is deliberate: a caller cannot forget to handle a
   * thrown error the way it can forget a null check.
   */
  verify(token: string): Promise<VerifiedIdentity>;

  /** For logs and `/health`-style introspection. Never used for branching. */
  readonly providerName: string;
}
