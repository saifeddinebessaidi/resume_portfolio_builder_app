import { Injectable, Logger } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { AppConfigService } from "../../config/app-config.service";
import { TokenInvalidError } from "../../common/errors/errors";
import { type TokenVerifier, type VerifiedIdentity } from "./token-verifier";

/**
 * The production identity provider: verifies Supabase's JWT against its JWKS endpoint.
 *
 * **Written now, wired when `AUTH_PROVIDER=supabase`.** Nothing else in the application changes
 * when that flips — which is the entire point of the port. Until then `LocalJwtVerifier` is bound
 * and this class is never instantiated.
 *
 * `jose` over `jsonwebtoken` because `createRemoteJWKSet` handles key fetching, caching, key
 * rotation and `kid` lookup, all of which are worth not hand-rolling.
 *
 * **Asymmetric verification, never the shared secret.** Supabase supports both (legacy HS256 with
 * the project's JWT secret, and RS256/ES256 via JWKS). JWKS is chosen so this service can verify
 * but not forge: it never holds a signing key. If the project turns out to issue HS256 only,
 * enable asymmetric keys in the Supabase dashboard rather than shipping a shared secret into the
 * API's environment.
 *
 * There is deliberately no service-role key anywhere here — see ADR-0001. This service verifies
 * tokens and never acts as Supabase admin.
 */
@Injectable()
export class SupabaseJwtVerifier implements TokenVerifier {
  readonly providerName = "supabase";

  private readonly logger = new Logger(SupabaseJwtVerifier.name);
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(private readonly config: AppConfigService) {
    const baseUrl = config.supabaseUrl.replace(/\/$/, "");
    this.issuer = `${baseUrl}/auth/v1`;

    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), {
      // Refuses to re-fetch more than once per 30s, so an invalid `kid` cannot be turned into a
      // request amplifier against Supabase.
      cooldownDuration: 30_000,
      // Keys are cached for 10 minutes; rotation is picked up on the next miss.
      cacheMaxAge: 600_000,
    });

    this.logger.log(`Verifying tokens against ${this.issuer}`);
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        // The issuer check is what makes a token from a *different* Supabase project fail.
        issuer: this.issuer,
        audience: this.config.supabaseJwtAudience,
        clockTolerance: 5,
      });

      if (!payload.sub) throw new TokenInvalidError("missing sub claim");

      const email = typeof payload.email === "string" ? payload.email : "";

      // Note what is NOT read: `role`, `app_metadata`, `user_metadata`. A returning user's
      // privileges come from our own `User.role` column, never from a claim they can influence.
      return { externalAuthId: payload.sub, email };
    } catch (error) {
      if (error instanceof TokenInvalidError) throw error;
      throw new TokenInvalidError(error instanceof Error ? error.message : "verification failed");
    }
  }
}
