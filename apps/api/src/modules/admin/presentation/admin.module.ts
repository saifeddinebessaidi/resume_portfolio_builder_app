import { Module } from "@nestjs/common";

import { ADMIN_READ_MODEL, ADMIN_REPOSITORY } from "../domain/admin.repository";
import { AccessOverridesUseCase } from "../application/access-overrides.use-case";
import { AdminOperationsController } from "./admin-operations.controller";
import { AdminUsersController } from "./admin-users.controller";
import { BillingModule } from "../../billing/presentation/billing.module";
import { CatalogModule } from "../../catalog/presentation/catalog.module";
import { GetAdminUserUseCase } from "../application/get-admin-user.use-case";
import { ManageSubscriptionUseCase } from "../application/manage-subscription.use-case";
import { OrderSettlementUseCase } from "../application/order-settlement.use-case";
import {
  PrismaAdminReadModel,
  PrismaAdminRepository,
} from "../infrastructure/prisma-admin.repository";
import { SubscriptionsModule } from "../../subscriptions/presentation/subscriptions.module";
import { TRANSACTION_RUNNER } from "../../subscriptions/domain/transaction-runner.port";
import { UnitOfWork } from "../../../infrastructure/prisma/unit-of-work";
import { UpdateUserUseCase } from "../application/update-user.use-case";
import { UsersModule } from "../../users/presentation/users.module";

/**
 * The back office. Depends on everything, and nothing depends on it — admin is a leaf, so it can
 * reach into users, catalog, subscriptions and billing without creating a cycle.
 *
 * Every controller here carries `@UseGuards(RolesGuard) @Roles("ADMIN")` at class level, so a new
 * route added to either is admin-only by default.
 */
@Module({
  imports: [UsersModule, CatalogModule, SubscriptionsModule, BillingModule],
  controllers: [AdminUsersController, AdminOperationsController],
  providers: [
    GetAdminUserUseCase,
    UpdateUserUseCase,
    AccessOverridesUseCase,
    ManageSubscriptionUseCase,
    OrderSettlementUseCase,
    { provide: ADMIN_READ_MODEL, useClass: PrismaAdminReadModel },
    { provide: ADMIN_REPOSITORY, useClass: PrismaAdminRepository },
    { provide: TRANSACTION_RUNNER, useExisting: UnitOfWork },
  ],
})
export class AdminModule {}
