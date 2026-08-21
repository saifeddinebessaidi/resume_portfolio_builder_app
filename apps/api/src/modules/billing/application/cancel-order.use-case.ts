import { Inject, Injectable, Logger } from "@nestjs/common";

import { AUDIT_LOG, type AuditLogPort } from "../../subscriptions/domain/audit-log.port";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { NotFoundError, OrderNotPayableError } from "../../../common/errors/errors";
import { ORDER_REPOSITORY, type OrderRepository } from "../domain/order.repository";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";
import { assertTransition, type Order } from "../domain/order.entity";

export interface CancelOrderCommand {
  orderId: string;
  /** The signed-in customer. An admin path will pass `actorUserId` separately in step 03. */
  userId: string;
  reason?: string | undefined;
  ip?: string | undefined;
}

/**
 * A customer abandoning a checkout, or changing their mind about a bank transfer they never sent.
 *
 * Only `PENDING` orders can be canceled — a paid one is refunded, which is a money movement and
 * therefore a different operation entirely (step 03).
 */
@Injectable()
export class CancelOrderUseCase {
  private readonly logger = new Logger(CancelOrderUseCase.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
  ) {}

  async execute(command: CancelOrderCommand): Promise<Order> {
    const order = await this.orders.findByIdForUser(command.orderId, command.userId);
    if (!order) throw new NotFoundError("Cette commande est introuvable.");

    // From the entity, so the same rule holds on the admin path and the cron.
    assertTransition(order, "CANCELED");

    return this.uow.run(async (tx) => {
      const canceled = await this.orders.transition(tx, {
        orderId: order.id,
        from: "PENDING",
        to: "CANCELED",
      });

      // Zero rows updated means the order moved between the read and the write — a webhook landing
      // mid-request, or a double-clicked cancel. The conditional update is what makes that safe;
      // this turns it into the same 409 the entity would have thrown.
      if (!canceled) throw new OrderNotPayableError(order.status);

      await this.audit.record(tx, {
        actorUserId: command.userId,
        action: "order.canceled",
        entityType: "Order",
        entityId: order.id,
        before: { status: order.status },
        after: {
          status: "CANCELED",
          reason: command.reason ?? "canceled by the customer",
          canceledAt: this.clock.now().toISOString(),
        },
        ip: command.ip ?? null,
      });

      this.logger.log(`Order ${order.id} canceled by user ${command.userId}`);

      return canceled;
    });
  }
}
