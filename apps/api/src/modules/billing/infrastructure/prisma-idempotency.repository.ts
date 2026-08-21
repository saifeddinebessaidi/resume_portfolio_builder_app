import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type IdempotencyRecord, type IdempotencyStore } from "../domain/idempotency.port";
import { type Tx } from "../../subscriptions/domain/subscription.repository";

function client(prisma: PrismaService, tx: Tx): Prisma.TransactionClient {
  return (tx as Prisma.TransactionClient | undefined) ?? prisma;
}

@Injectable()
export class PrismaIdempotencyStore implements IdempotencyStore {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: string, key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    });

    if (!row) return null;

    return {
      key: row.key,
      userId: row.userId,
      requestHash: row.requestHash,
      resourceId: row.resourceId,
    };
  }

  /**
   * A plain `create`, deliberately not an upsert.
   *
   * The unique violation on a duplicate is the whole mechanism: two concurrent requests carrying
   * one key both reach here, the loser blocks on the primary key until the winner's transaction
   * commits, and then fails. The use case catches that failure and replays the winner's order —
   * which is how "exactly one order" becomes a database guarantee rather than a hopeful read.
   * An upsert would swallow the collision and let both callers proceed to create an order.
   */
  async claim(tx: Tx, record: { userId: string; key: string; requestHash: string }): Promise<void> {
    await client(this.prisma, tx).idempotencyKey.create({
      data: { userId: record.userId, key: record.key, requestHash: record.requestHash },
    });
  }

  async attach(tx: Tx, args: { userId: string; key: string; resourceId: string }): Promise<void> {
    await client(this.prisma, tx).idempotencyKey.update({
      where: { userId_key: { userId: args.userId, key: args.key } },
      data: { resourceId: args.resourceId },
    });
  }

  async pruneOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return result.count;
  }
}
