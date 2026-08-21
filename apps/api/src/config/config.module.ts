import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";

import { AppConfigService } from "./app-config.service";
import { validateEnv } from "./env.schema";

/**
 * Global so no other module has to import it to inject AppConfigService. Configuration is
 * genuinely cross-cutting — every module needs it and none of them own it.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // apps/api/.env in development; on a platform the variables are already in the
      // process environment and this file simply does not exist.
      envFilePath: [".env"],
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
