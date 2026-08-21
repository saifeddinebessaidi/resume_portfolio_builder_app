import { Global, Logger, Module } from "@nestjs/common";

import { AppConfigService } from "../../config/app-config.service";
import { LocalJwtVerifier } from "./local-jwt.verifier";
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
    LocalJwtVerifier,
    {
      provide: TOKEN_VERIFIER,
      inject: [AppConfigService, LocalJwtVerifier],
      useFactory: (config: AppConfigService, local: LocalJwtVerifier): TokenVerifier => {
        const logger = new Logger("AuthModule");

        if (config.authProvider === "supabase") {
          logger.log("Auth provider: supabase (RS256 via JWKS)");
          return new SupabaseJwtVerifier(config);
        }

        // env.schema.ts refuses to boot with this provider in production, so reaching here in a
        // deployed environment is impossible rather than merely discouraged.
        logger.warn("Auth provider: local (development only)");
        return local;
      },
    },
  ],
  exports: [TOKEN_VERIFIER, LocalJwtVerifier],
})
export class AuthModule {}
