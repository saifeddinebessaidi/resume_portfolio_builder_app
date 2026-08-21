import { Module } from "@nestjs/common";

import { CancelOrderUseCase } from "../application/cancel-order.use-case";
import { CancelStaleOrdersUseCase } from "../application/cancel-stale-orders.use-case";
import { CatalogModule } from "../../catalog/presentation/catalog.module";
import { CreateOrderUseCase } from "../application/create-order.use-case";
import { GetOrderUseCase } from "../application/get-order.use-case";
import { IDEMPOTENCY_STORE } from "../domain/idempotency.port";
import { INVOICE_NUMBER_SERVICE } from "../domain/invoice-number.service";
import { ListMyOrdersUseCase } from "../application/list-my-orders.use-case";
import { ORDER_REPOSITORY } from "../domain/order.repository";
import { OrdersController } from "./orders.controller";
import { PAYMENT_REPOSITORY } from "../domain/payment.repository";
import { PostgresInvoiceNumberService } from "../infrastructure/postgres-invoice-number.service";
import { PrismaIdempotencyStore } from "../infrastructure/prisma-idempotency.repository";
import { PrismaOrderRepository } from "../infrastructure/prisma-order.repository";
import { PrismaPaymentRepository } from "../infrastructure/prisma-payment.repository";
import { StaleOrdersCron } from "./stale-orders.cron";
import { SubscriptionsModule } from "../../subscriptions/presentation/subscriptions.module";
import { TRANSACTION_RUNNER } from "../../subscriptions/domain/transaction-runner.port";
import { UnitOfWork } from "../../../infrastructure/prisma/unit-of-work";

/**
 * Billing depends on subscriptions, one direction only — for `AUDIT_LOG`, and in step 04 for the
 * activation that a paid order triggers. The engine knows nothing about orders, which is what
 * keeps this a dependency rather than a cycle.
 *
 * `PAYMENT_REPOSITORY` and `INVOICE_NUMBER_SERVICE` are bound here although no use case in this
 * step injects them: both are exported for step 03's `MANUAL` provider, and binding them now is
 * what makes that step an adapter rather than a rewiring.
 */
@Module({
  imports: [SubscriptionsModule, CatalogModule],
  controllers: [OrdersController],
  providers: [
    CreateOrderUseCase,
    ListMyOrdersUseCase,
    GetOrderUseCase,
    CancelOrderUseCase,
    CancelStaleOrdersUseCase,
    StaleOrdersCron,
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    { provide: PAYMENT_REPOSITORY, useClass: PrismaPaymentRepository },
    { provide: IDEMPOTENCY_STORE, useClass: PrismaIdempotencyStore },
    { provide: INVOICE_NUMBER_SERVICE, useClass: PostgresInvoiceNumberService },
    { provide: TRANSACTION_RUNNER, useExisting: UnitOfWork },
  ],
  exports: [ORDER_REPOSITORY, PAYMENT_REPOSITORY, INVOICE_NUMBER_SERVICE],
})
export class BillingModule {}
