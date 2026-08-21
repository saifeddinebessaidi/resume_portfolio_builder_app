import { createHash } from "node:crypto";

import { Injectable, Logger } from "@nestjs/common";
import { SignJWT, jwtVerify } from "jose";

import { AppConfigService } from "../../config/app-config.service";
import { TokenInvalidError } from "../../common/errors/errors";
import { type TokenVerifier, type VerifiedIdentity } from "./token-verifier";

const ISSUER = "reacchy-local-auth";
const AUDIENCE = "authenticated";

/**
 * Development-only identity provider.
 *
 * The API signs and verifies its own HS256 tokens so the entire entitlement engine — quotas,
 * revisions, ownership isolation — can be built and exercised before Supabase is wired in.
 * Swapping to Supabase later changes one binding in `auth.module.ts`: no guard, controller or use
 * case is aware of which adapter is active.
 *
 * This is symmetric signing, which means this service can *forge* tokens as well as verify them.
 * That is acceptable for local development and unacceptable in production — which is why
 * `env.schema.ts` refuses to boot with `AUTH_PROVIDER=local` when `NODE_ENV=production`, rather
 * than leaving it to a deployment checklist.
 */
@Injectable()
export class LocalJwtVerifier implements TokenVerifier {
  readonly providerName = "local";

  private readonly logger = new Logger(LocalJwtVerifier.name);
  private readonly secret: Uint8Array;

  constructor(private readonly config: AppConfigService) {
    this.secret = new TextEncoder().encode(config.localAuthSecret);
    this.logger.warn(
      "Using the LOCAL development auth provider. Tokens are signed by this service itself " +
        "and are not suitable for any shared environment.",
    );
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
        // Absorbs small clock skew, which otherwise produces intermittent, unreproducible
        // `exp` failures that look like random logouts.
        clockTolerance: 5,
      });

      if (!payload.sub) throw new TokenInvalidError("missing sub claim");

      const email = typeof payload.email === "string" ? payload.email : "";
      if (!email) throw new TokenInvalidError("missing email claim");

      // Any `role` claim in the token is read and discarded. Roles come from our database only.
      return { externalAuthId: payload.sub, email };
    } catch (error) {
      if (error instanceof TokenInvalidError) throw error;
      throw new TokenInvalidError(error instanceof Error ? error.message : "verification failed");
    }
  }

  /**
   * Mints a development token. Exposed through a dev-only endpoint so the whole API can be
   * exercised with `curl` before any identity provider exists.
   *
   * The subject is derived deterministically from the email, so the same address always maps to
   * the same local identity across restarts — which is what makes JIT provisioning testable.
   */
  async issue(email: string): Promise<{ accessToken: string; expiresIn: number; subject: string }> {
    const normalized = email.trim().toLowerCase();
    const subject = `local_${createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
    const expiresIn = this.config.localAuthTokenTtlSeconds;

    const accessToken = await new SignJWT({ email: normalized })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(subject)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(this.secret);

    return { accessToken, expiresIn, subject };
  }
}
