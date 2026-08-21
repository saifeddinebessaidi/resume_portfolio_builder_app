import { Module } from "@nestjs/common";

import { AUDIT_LOG } from "../domain/audit-log.port";
import { AdminSubscriptionsController } from "./admin-subscriptions.controller";
import { CATEGORY_RESOLVER } from "../domain/category-resolver.port";
import { CatalogModule } from "../../catalog/presentation/catalog.module";
import { ConsumeEntitlementService } from "../application/consume-entitlement.service";
import { EntitlementGuard } from "./entitlement.guard";
import { GrantSubscriptionUseCase } from "../application/grant-subscription.use-case";
import { ListMySubscriptionsUseCase } from "../application/list-my-subscriptions.use-case";
import { PrismaAuditLog } from "../infrastructure/prisma-audit-log";
import { PrismaCategoryResolver } from "../infrastructure/prisma-category-resolver";
import { PROJECT_COUNTER } from "../domain/free-tier";
import { PrismaProjectCounter } from "../infrastructure/prisma-project-counter";
import { PrismaSubscriptionRepository } from "../infrastructure/prisma-subscription.repository";
import { PrismaUsageCounterRepository } from "../infrastructure/prisma-usage-counter.repository";
import { ResolveEntitlementsUseCase } from "../application/resolve-entitlements.use-case";
import {
  SUBSCRIPTION_REPOSITORY,
  USAGE_COUNTER_REPOSITORY,
} from "../domain/subscription.repository";
import { SubscriptionsController } from "./subscriptions.controller";
import { TRANSACTION_RUNNER } from "../domain/transaction-runner.port";
import { UnitOfWork } from "../../../infrastructure/prisma/unit-of-work";

/**
 * The entitlement engine.
 *
 * `EntitlementGuard` is exported rather than registered globally: it needs `@RequireEntitlement()`
 * metadata to do anything, and the routes that carry it live in the projects module.
 *
 * Note the absence of a projects import. The guard resolves a project's category through
 * `CATEGORY_RESOLVER`, which the projects module provides — otherwise the two modules would be
 * mutually dependent and Nest would need `forwardRef`, which papers over a circular dependency
 * instead of removing it.
 */
@Module({
  imports: [CatalogModule],
  controllers: [SubscriptionsController, AdminSubscriptionsController],
  providers: [
    ResolveEntitlementsUseCase,
    ConsumeEntitlementService,
    ListMySubscriptionsUseCase,
    GrantSubscriptionUseCase,
    EntitlementGuard,
    { provide: SUBSCRIPTION_REPOSITORY, useClass: PrismaSubscriptionRepository },
    { provide: USAGE_COUNTER_REPOSITORY, useClass: PrismaUsageCounterRepository },
    { provide: AUDIT_LOG, useClass: PrismaAuditLog },
    { provide: CATEGORY_RESOLVER, useClass: PrismaCategoryResolver },
    // The free-tier cap needs a project count; read from this side to avoid a forwardRef cycle.
    { provide: PROJECT_COUNTER, useClass: PrismaProjectCounter },
    // The port from domain/ bound to the Prisma implementation, so no use case imports
    // infrastructure/ directly — enforced by the zone rule in eslint.config.mjs.
    { provide: TRANSACTION_RUNNER, useExisting: UnitOfWork },
  ],
  exports: [
    // Consumed by the projects module (step 09) and the dashboard summary (step 10).
    ResolveEntitlementsUseCase,
    ConsumeEntitlementService,
    EntitlementGuard,
    // Exported because `@UseGuards(EntitlementGuard)` in the projects controller makes Nest build the
    // guard in THAT module's injector, where these dependencies must be visible. Without them the
    // app fails at boot with an unresolvable-dependency error rather than at request time — which is
    // the right direction for this mistake to fail in.
    CATEGORY_RESOLVER,
    ResolveEntitlementsUseCase,
    SUBSCRIPTION_REPOSITORY,
    AUDIT_LOG,
    // Injected by the projects module's create use case to enforce the free-tier cap.
    PROJECT_COUNTER,
  ],
})
export class SubscriptionsModule {}
