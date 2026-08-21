import { type DynamicModule, Logger, Module } from "@nestjs/common";

import { DevAuthController } from "./dev-auth.controller";

/**
 * Registers the development token endpoint **conditionally**.
 *
 * When the local provider is not active the returned module has no controller at all, so the route
 * does not exist — a 404 rather than a disabled handler. That is a stronger guarantee than a
 * runtime check, because there is nothing to bypass. The controller keeps its own check anyway;
 * an endpoint that hands out a token for any email address deserves two independent locks.
 */
@Module({})
export class DevAuthModule {
  static forProvider(provider: string): DynamicModule {
    if (provider !== "local") {
      return { module: DevAuthModule };
    }

    new Logger(DevAuthModule.name).warn(
      "POST /api/v1/dev-auth/token is mounted. It issues a bearer token for any email address " +
        "and exists only because AUTH_PROVIDER=local.",
    );

    return {
      module: DevAuthModule,
      controllers: [DevAuthController],
    };
  }
}
