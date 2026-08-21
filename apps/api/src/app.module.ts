import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AppConfigModule } from "./config/config.module";
import { AuthGuard } from "./common/guards/auth.guard";
import { AuthModule } from "./infrastructure/auth/auth.module";
import { BillingModule } from "./modules/billing/presentation/billing.module";
import { CatalogModule } from "./modules/catalog/presentation/catalog.module";
import { ClockModule } from "./common/clock/clock.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { DevAuthModule } from "./modules/dev-auth/dev-auth.module";
import { GenerationModule } from "./modules/generation/presentation/generation.module";
import { HealthModule } from "./modules/health/health.module";
import { LoggingModule } from "./infrastructure/logging/logging.module";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { ProjectsModule } from "./modules/projects/presentation/projects.module";
import { RequestContextMiddleware } from "./common/context/request-context.middleware";
import { ScheduleModule } from "@nestjs/schedule";
import { SubscriptionsModule } from "./modules/subscriptions/presentation/subscriptions.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { UsersModule } from "./modules/users/presentation/users.module";
import { loadEnv } from "./config/env.schema";

@Module({
  imports: [
    // The first four are @Global. Order matters for readability only.
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    ClockModule,
    AuthModule,

    /**
     * The scheduler for the nightly jobs: the stale-order sweep here, subscription expiry in step
     * 04. Registered once at the root — `@nestjs/schedule` discovers `@Cron` methods across every
     * module, so a second registration would run every job twice.
     */
    ScheduleModule.forRoot(),

    UsersModule,
    CatalogModule,
    SubscriptionsModule,
    ProjectsModule,
    BillingModule,
    UploadsModule,
    GenerationModule,
    DashboardModule,
    HealthModule,

    // Mounts POST /dev-auth/token only when AUTH_PROVIDER=local. In any other mode the module has
    // no controller, so the route does not exist rather than being disabled.
    DevAuthModule.forProvider(loadEnv().AUTH_PROVIDER),
  ],
  providers: [
    /**
     * Authentication is **opt-out**, via `@Public()`, not opt-in.
     *
     * A route whose author forgot to think about auth returns 401 — the safe direction for that
     * mistake. The inverse would mean a forgotten decorator silently exposes user data, which is
     * the same class of bug as ownership checks living only in a guard.
     */
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  /**
   * The context middleware runs before guards, interceptors and pipes, which is the only position
   * from which `requestId` is available to everything that might log or throw. An interceptor
   * would be too late: a guard rejecting a request would log without a request id.
   */
  configure(consumer: MiddlewareConsumer): void {
    // `{*path}` is the path-to-regexp v8 spelling of "everything". A bare `*` is v6 syntax, which
    // Nest 11 only auto-converts with a warning.
    consumer.apply(RequestContextMiddleware).forRoutes("{*path}");
  }
}
