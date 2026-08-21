import { Injectable } from "@nestjs/common";
import { type EntitlementKey, type Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  type Tx,
  type UsageCounterRepository,
  type UsageSnapshot,
} from "../domain/subscription.repository";

@Injectable()
export class PrismaUsageCounterRepository implements UsageCounterRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForSubscription(subscriptionId: string): Promise<UsageSnapshot[]> {
    const rows = await this.prisma.usageCounter.findMany({
      where: { subscriptionId },
      orderBy: { periodStart: "desc" },
    });

    return rows.map((r) => ({
      key: r.key,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      used: r.used,
    }));
  }

  /**
   * The concurrency control, in one statement.
   *
   * `upsert` on the composite unique `(subscriptionId, key, periodStart)` takes a row-level lock: two
   * simultaneous consumers of the same counter serialise here, and the second one reads a value that
   * already includes the first one's increment. That is what makes the caller's
   * "is `used` over the limit?" check a real gate.
   *
   * A `SELECT count(*)` followed by an `INSERT` — the obvious implementation — lets both requests
   * read the pre-increment value and both proceed, producing 4 projects on a 3-project plan. It is
   * invisible in manual testing and shows up on a double-click.
   *
   * **`tx` is required, not optional.** If the increment could commit independently of the mutation
   * it authorizes, a rolled-back create would still have spent the user's quota.
   */
  async incrementAndRead(
    tx: Tx,
    args: { subscriptionId: string; key: string; periodStart: Date; periodEnd: Date },
  ): Promise<number> {
    const client = tx as Prisma.TransactionClient;

    const counter = await client.usageCounter.upsert({
      where: {
        subscriptionId_key_periodStart: {
          subscriptionId: args.subscriptionId,
          key: args.key as EntitlementKey,
          periodStart: args.periodStart,
        },
      },
      create: {
        subscriptionId: args.subscriptionId,
        key: args.key as EntitlementKey,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        used: 1,
      },
      update: { used: { increment: 1 } },
    });

    return counter.used;
  }
}
