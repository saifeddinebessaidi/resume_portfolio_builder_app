import { Inject, Injectable, Logger } from "@nestjs/common";

import { AUDIT_LOG, type AuditLogPort } from "../../subscriptions/domain/audit-log.port";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { IDEMPOTENCY_STORE, type IdempotencyStore } from "../domain/idempotency.port";
import { ORDER_REPOSITORY, type OrderRepository } from "../domain/order.repository";
import { STALE_ORDER_DAYS } from "../domain/order.entity";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";

/** A ceiling per run, so a backlog is drained over several nights instead of one long transaction. */
const BATCH_LIMIT = 500;

/** Idempotency keys are kept a day — orders of magnitude longer than any client retry window. */
const IDEMPOTENCY_RETENTION_HOURS = 24;

export interface StaleOrderSweepResult {
  canceled: number;
  prunedIdempotencyKeys: number;
}

/**
 * The nightly housekeeping sweep: cancel abandoned orders, prune spent idempotency keys.
 *
 * Without it, bank-transfer orders that were never paid accumulate forever, and "orders pending"
 * stops meaning "awaiting money" — which makes the abandonment metric in phase 8 unreadable.
 *
 * Each cancellation is a separate transaction with its own audit row rather than one bulk
 * `updateMany`. Slower, and deliberately so: a bulk update cancels a customer's order with no
 * record of why, and "why was my order canceled" is a question that gets asked.
 */
@Injectable()
export class CancelStaleOrdersUseCase {
  private readonly logger = new Logger(CancelStaleOrdersUseCase.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
  ) {}

  async execute(): Promise<StaleOrderSweepResult> {
    const now = this.clock.now();

    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - STALE_ORDER_DAYS);

    const stale = await this.orders.findStalePending(cutoff, BATCH_LIMIT);
    let canceled = 0;

    for (const order of stale) {
      const result = await this.uow.run(async (tx) => {
        const updated = await this.orders.transition(tx, {
          orderId: order.id,
          from: "PENDING",
          to: "CANCELED",
        });

        // Paid or canceled between the query and now. Not an error — the conditional update did
        // its job and there is nothing left to do for this row.
        if (!updated) return false;

        await this.audit.record(tx, {
          actorUserId: null,
          action: "order.canceled",
          entityType: "Order",
          entityId: order.id,
          before: { status: "PENDING", createdAt: order.createdAt.toISOString() },
          after: {
            status: "CANCELED",
            reason: `unpaid for more than ${String(STALE_ORDER_DAYS)} days`,
            canceledAt: now.toISOString(),
          },
          ip: null,
        });

        return true;
      });

      if (result) canceled += 1;
    }

    const retentionCutoff = new Date(now.getTime() - IDEMPOTENCY_RETENTION_HOURS * 3_600_000);
    const prunedIdempotencyKeys = await this.idempotency.pruneOlderThan(retentionCutoff);

    if (canceled > 0 || prunedIdempotencyKeys > 0) {
      this.logger.log(
        `Stale-order sweep: canceled ${String(canceled)} order(s), ` +
          `pruned ${String(prunedIdempotencyKeys)} idempotency key(s)`,
      );
    }

    return { canceled, prunedIdempotencyKeys };
  }
}
