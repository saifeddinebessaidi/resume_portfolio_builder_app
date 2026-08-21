import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "../../catalog/domain/catalog.repository";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { NotFoundError, PlanInactiveError } from "../../../common/errors/errors";
import { termEnd } from "../../catalog/domain/catalog.entity";
import { type Subscription } from "../domain/subscription.entity";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from "../domain/subscription.repository";
import { AUDIT_LOG, type AuditLogPort } from "../domain/audit-log.port";
import { TRANSACTION_RUNNER, type TransactionRunner } from "../domain/transaction-runner.port";

export interface GrantSubscriptionCommand {
  actorUserId: string;
  targetUserId: string;
  planCode: string;
  startsAt?: Date;
  note: string;
  ip?: string | undefined;
}

/**
 * Manual activation: the only way a subscription comes into existence until phase 7.
 *
 * It exists in phase 2, ahead of billing, for a practical reason: **without a way to activate a
 * subscription, nothing about quotas can be tested.** It also writes the snapshot columns and an
 * audit row, so this path exercises the same code the real gateway will call later — the phase 7
 * `MANUAL` provider becomes a caller of this, not a reimplementation of it.
 */
@Injectable()
export class GrantSubscriptionUseCase {
  private readonly logger = new Logger(GrantSubscriptionUseCase.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
  ) {}

  async execute(command: GrantSubscriptionCommand): Promise<Subscription> {
    const plan = await this.catalog.findPlanByCode(command.planCode);
    if (!plan) throw new NotFoundError("Cette offre est introuvable.");

    // Found-but-retired is a different answer from not-found, which is why findPlanByCode does not
    // filter on isActive: a 404 here would send an admin looking for a typo.
    if (!plan.isActive) throw new PlanInactiveError(plan.code);

    const now = this.clock.now();
    const startsAt = command.startsAt ?? now;
    const endsAt = termEnd(plan, startsAt);

    return this.uow.run(async (tx) => {
      /**
       * Cancel then create, in ONE transaction.
       *
       * The partial unique index allows a single ACTIVE row per (user, category), so these two
       * statements have to commit together — otherwise a legitimate plan switch either leaves two
       * active rows (if the index were absent) or fails on the insert (because the old row is still
       * ACTIVE). This is also exactly the plan-switch behaviour the FAQ promises.
       */
      const canceled = await this.subs.cancelActiveFor(
        tx,
        command.targetUserId,
        plan.categoryId,
        now,
      );

      const subscription = await this.subs.create(tx, {
        userId: command.targetUserId,
        planId: plan.id,
        categoryId: plan.categoryId,
        startsAt,
        endsAt,
        source: "MANUAL_GRANT",
        orderId: null,
        // The financial record. A later price edit must not rewrite what this holder was granted.
        planCodeSnapshot: plan.code,
        priceMinorSnapshot: plan.priceMinor,
        currencySnapshot: plan.currency,
      });

      // A free grant must be explicable months later: who did it, to whom, on what plan, and why.
      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: "subscription.granted",
        entityType: "Subscription",
        entityId: subscription.id,
        before: canceled > 0 ? { canceledActiveSubscriptions: canceled } : null,
        after: {
          userId: command.targetUserId,
          planCode: plan.code,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          priceMinor: plan.priceMinor,
          currency: plan.currency,
          note: command.note,
        },
        ip: command.ip ?? null,
      });

      this.logger.log(
        `Granted ${plan.code} to user ${command.targetUserId} until ${endsAt.toISOString()}` +
          (canceled > 0 ? ` (canceled ${canceled} active subscription)` : ""),
      );

      return subscription;
    });
  }
}
