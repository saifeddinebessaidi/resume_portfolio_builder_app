import { Inject, Injectable, Logger } from "@nestjs/common";

import { ADMIN_REPOSITORY, type AdminRepository } from "../domain/admin.repository";
import { AUDIT_LOG, type AuditLogPort } from "../../subscriptions/domain/audit-log.port";
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "../../catalog/domain/catalog.repository";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import {
  INVOICE_NUMBER_SERVICE,
  type InvoiceNumberService,
} from "../../billing/domain/invoice-number.service";
import { NotFoundError, OrderNotPayableError } from "../../../common/errors/errors";
import { ORDER_REPOSITORY, type OrderRepository } from "../../billing/domain/order.repository";
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from "../../billing/domain/payment.repository";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from "../../subscriptions/domain/subscription.repository";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";
import { assertTransition, type Order } from "../../billing/domain/order.entity";
import { termEnd } from "../../catalog/domain/catalog.entity";

interface Command {
  actorUserId: string;
  orderId: string;
  reason: string;
  ip?: string | undefined;
}

/**
 * The `MANUAL` provider's two admin actions (phase 7 step 03): mark an order paid, refund it.
 *
 * Mark-paid does everything a hand-written `UPDATE` would skip — a `Payment` row, an invoice number,
 * the subscription and an audit row — in one transaction. When a gateway's settle path lands, this
 * becomes a caller of it rather than a parallel implementation.
 */
@Injectable()
export class OrderSettlementUseCase {
  private readonly logger = new Logger(OrderSettlementUseCase.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(INVOICE_NUMBER_SERVICE) private readonly invoices: InvoiceNumberService,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
  ) {}

  /**
   * **Marking the same order paid twice activates once.** An order already PAID is returned as is,
   * and `orders.markPaid` is conditional on PENDING, so a concurrent double-click updates zero rows
   * on the second call and rolls back before it can create a second subscription.
   */
  async markPaid(command: Command & { providerRef?: string | undefined }): Promise<Order> {
    const order = await this.orders.findById(command.orderId);
    if (!order) throw new NotFoundError("Cette commande est introuvable.");
    if (order.status === "PAID") return order;
    assertTransition(order, "PAID");

    // Resolved by the snapshot code, and not filtered on isActive: a plan retired after the
    // customer ordered it must still be honoured. Outside the transaction — see ConsumeEntitlementService.
    const plan = await this.catalog.findPlanByCode(order.planCodeSnapshot);
    if (!plan) throw new NotFoundError("L'offre de cette commande est introuvable.");

    const now = this.clock.now();

    return this.uow.run(async (tx) => {
      const invoiceNumber = await this.invoices.next(tx, now.getUTCFullYear());
      const paid = await this.orders.markPaid(tx, {
        orderId: order.id,
        invoiceNumber,
        paidAt: now,
      });
      // Lost the race to a concurrent call. Throwing rolls back the invoice number with it.
      if (!paid) throw new OrderNotPayableError(order.status);

      await this.payments.record(tx, {
        orderId: order.id,
        provider: "MANUAL",
        status: "SUCCEEDED",
        amountMinor: order.amountMinor,
        currency: order.currency,
        providerRef: command.providerRef ?? null,
        occurredAt: now,
      });

      const canceled = await this.subs.cancelActiveFor(tx, order.userId, order.categoryId, now);
      const subscription = await this.subs.create(tx, {
        userId: order.userId,
        planId: order.planId,
        categoryId: order.categoryId,
        startsAt: now,
        endsAt: termEnd(plan, now),
        source: "CHECKOUT",
        orderId: order.id,
        // From the order, not the live plan: what the customer was charged is the financial record.
        planCodeSnapshot: order.planCodeSnapshot,
        priceMinorSnapshot: order.amountMinor,
        currencySnapshot: order.currency,
      });

      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: "order.marked_paid",
        entityType: "Order",
        entityId: order.id,
        before: { status: order.status },
        after: {
          status: "PAID",
          invoiceNumber,
          subscriptionId: subscription.id,
          canceledActiveSubscriptions: canceled,
          providerRef: command.providerRef ?? null,
          reason: command.reason,
        },
        ip: command.ip ?? null,
      });

      this.logger.log(`Order ${order.id} marked paid by ${command.actorUserId} (${invoiceNumber})`);
      return paid;
    });
  }

  /**
   * Records a refund decision. `MANUAL` and `BANK_TRANSFER` have no programmatic refund — the money
   * moves outside the system — so this writes the REFUNDED order, a negative payment and the canceled
   * subscription, and the UI says plainly that no money has moved.
   */
  async refund(command: Command): Promise<Order> {
    const order = await this.orders.findById(command.orderId);
    if (!order) throw new NotFoundError("Cette commande est introuvable.");
    assertTransition(order, "REFUNDED");

    const now = this.clock.now();

    return this.uow.run(async (tx) => {
      const refunded = await this.orders.transition(tx, {
        orderId: order.id,
        from: "PAID",
        to: "REFUNDED",
      });
      if (!refunded) throw new OrderNotPayableError(order.status);

      await this.payments.record(tx, {
        orderId: order.id,
        provider: "MANUAL",
        status: "REFUNDED",
        amountMinor: -order.amountMinor,
        currency: order.currency,
        occurredAt: now,
      });

      const subscriptionId = await this.admin.findSubscriptionIdByOrder(tx, order.id);
      const canceled = subscriptionId
        ? await this.admin.cancelSubscription(tx, subscriptionId, now)
        : false;

      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: "order.refunded",
        entityType: "Order",
        entityId: order.id,
        before: { status: order.status },
        after: {
          status: "REFUNDED",
          subscriptionId,
          subscriptionCanceled: canceled,
          reason: command.reason,
        },
        ip: command.ip ?? null,
      });

      return refunded;
    });
  }
}
