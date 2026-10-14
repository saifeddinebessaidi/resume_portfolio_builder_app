import { SignJWT, jwtVerify } from "jose";

import { type AppConfigService } from "../../config/app-config.service";
import { TokenInvalidError } from "../../common/errors/errors";
import { type TokenVerifier, type VerifiedIdentity } from "./token-verifier";

const ISSUER = "reacchy-auth";
const AUDIENCE = "authenticated";

/**
 * AUTH_PROVIDER=password: this API is its own identity provider.
 *
 * HS256 with a server-only secret. The token carries the user's `externalAuthId` as `sub` and the
 * email, nothing else — any role claim would be ignored anyway, since roles come from the database.
 * Constructed only in password mode (see AuthModule), so the secret is always present here.
 */
export class PasswordJwtVerifier implements TokenVerifier {
  readonly providerName = "password";

  private readonly secret: Uint8Array;

  constructor(private readonly config: AppConfigService) {
    this.secret = new TextEncoder().encode(config.authJwtSecret);
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ["HS256"],
        clockTolerance: 5,
      });

      if (!payload.sub) throw new TokenInvalidError("missing sub claim");
      const email = typeof payload.email === "string" ? payload.email : "";
      if (!email) throw new TokenInvalidError("missing email claim");

      return { externalAuthId: payload.sub, email };
    } catch (error) {
      if (error instanceof TokenInvalidError) throw error;
      throw new TokenInvalidError(error instanceof Error ? error.message : "verification failed");
    }
  }

  async issue(identity: VerifiedIdentity): Promise<{ accessToken: string; expiresIn: number }> {
    const expiresIn = this.config.authTokenTtlSeconds;

    const accessToken = await new SignJWT({ email: identity.email })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(identity.externalAuthId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(this.secret);

    return { accessToken, expiresIn };
  }
}
