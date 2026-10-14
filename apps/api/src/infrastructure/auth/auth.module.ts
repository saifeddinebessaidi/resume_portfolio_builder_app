import { Global, Logger, Module } from "@nestjs/common";

import { AppConfigService } from "../../config/app-config.service";
import { LocalJwtVerifier } from "./local-jwt.verifier";
import { PasswordJwtVerifier } from "./password-jwt.verifier";
import { SupabaseJwtVerifier } from "./supabase-jwt.verifier";
import { TOKEN_VERIFIER, type TokenVerifier } from "./token-verifier";
import { UsersModule } from "../../modules/users/presentation/users.module";

/**
 * Binds the `TokenVerifier` port to one adapter, chosen by configuration.
 *
 * **This factory is the entire cost of switching identity providers.** No guard, controller, use
 * case or repository references Supabase or the local signer; they all depend on the port. Adding a
 * third provider means a third adapter and one more branch here — open/closed, concretely.
 *
 * `LocalJwtVerifier` is also registered as a concrete provider so the dev-only token endpoint can
 * inject it directly to *mint* tokens, which is not part of the port's job (verification) and
 * should not be.
 */
@Global()
@Module({
  imports: [UsersModule],
  providers: [
    /**
     * Each self-issuing verifier is built only in its own mode: both read a secret that is absent in
     * the other modes, and constructing them eagerly would fail the boot. In the other modes the
     * provider resolves to null, and nothing that injects it is mounted.
     */
    {
      provide: LocalJwtVerifier,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): LocalJwtVerifier | null =>
        config.authProvider === "local" ? new LocalJwtVerifier(config) : null,
    },
    {
      provide: PasswordJwtVerifier,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): PasswordJwtVerifier | null =>
        config.authProvider === "password" ? new PasswordJwtVerifier(config) : null,
    },
    {
      provide: TOKEN_VERIFIER,
      inject: [AppConfigService, LocalJwtVerifier, PasswordJwtVerifier],
      useFactory: (
        config: AppConfigService,
        local: LocalJwtVerifier | null,
        password: PasswordJwtVerifier | null,
      ): TokenVerifier => {
        const logger = new Logger("AuthModule");

        if (config.authProvider === "supabase") {
          logger.log("Auth provider: supabase (RS256 via JWKS)");
          return new SupabaseJwtVerifier(config);
        }

        if (config.authProvider === "password" && password) {
          logger.log("Auth provider: password (HS256, issued by this API)");
          return password;
        }

        // env.schema.ts refuses to boot with this provider in production, so reaching here in a
        // deployed environment is impossible rather than merely discouraged.
        logger.warn("Auth provider: local (development only)");
        if (!local) throw new Error("LocalJwtVerifier missing for AUTH_PROVIDER=local");
        return local;
      },
    },
  ],
  exports: [TOKEN_VERIFIER, LocalJwtVerifier, PasswordJwtVerifier],
})
export class AuthModule {}
