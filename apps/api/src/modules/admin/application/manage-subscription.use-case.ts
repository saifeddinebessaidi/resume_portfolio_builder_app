import { Inject, Injectable } from "@nestjs/common";

import { ADMIN_REPOSITORY, type AdminRepository } from "../domain/admin.repository";
import { AUDIT_LOG, type AuditLogPort } from "../../subscriptions/domain/audit-log.port";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { NotFoundError } from "../../../common/errors/errors";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from "../../subscriptions/domain/subscription.repository";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";

const DAY_MS = 86_400_000;

interface Command {
  actorUserId: string;
  subscriptionId: string;
  reason: string;
  ip?: string | undefined;
}

/** Cancel or extend an existing subscription. Granting a new one stays GrantSubscriptionUseCase. */
@Injectable()
export class ManageSubscriptionUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
  ) {}

  /** Idempotent: canceling an already-canceled or expired subscription succeeds without a write. */
  async cancel(command: Command): Promise<void> {
    const sub = await this.subs.findById(command.subscriptionId);
    if (!sub) throw new NotFoundError("Cet abonnement est introuvable.");

    const now = this.clock.now();

    await this.uow.run(async (tx) => {
      const canceled = await this.admin.cancelSubscription(tx, sub.id, now);
      if (!canceled) return;

      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: "subscription.canceled",
        entityType: "Subscription",
        entityId: sub.id,
        before: { status: sub.status, endsAt: sub.endsAt.toISOString() },
        after: { status: "CANCELED", canceledAt: now.toISOString(), reason: command.reason },
        ip: command.ip ?? null,
      });
    });
  }

  /**
   * Adds `days` to the term. Counted from the later of `endsAt` and now, so extending a lapsed-but-
   * still-ACTIVE row gives the user the full extension rather than days already in the past.
   *
   * Only ACTIVE rows: reviving a CANCELED or EXPIRED one could collide with a newer ACTIVE row on the
   * partial unique index. Grant a new plan instead.
   */
  async extend(command: Command & { days: number }): Promise<void> {
    const sub = await this.subs.findById(command.subscriptionId);
    if (sub?.status !== "ACTIVE") {
      throw new NotFoundError("Aucun abonnement actif avec cet identifiant.");
    }

    const now = this.clock.now();
    const from = Math.max(sub.endsAt.getTime(), now.getTime());
    const endsAt = new Date(from + command.days * DAY_MS);

    await this.uow.run(async (tx) => {
      await this.admin.setSubscriptionEndsAt(tx, sub.id, endsAt);

      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: "subscription.extended",
        entityType: "Subscription",
        entityId: sub.id,
        before: { endsAt: sub.endsAt.toISOString() },
        after: { endsAt: endsAt.toISOString(), days: command.days, reason: command.reason },
        ip: command.ip ?? null,
      });
    });
  }
}
