import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";
import { type CategoryCode } from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type ProjectCounter } from "../domain/free-tier";
import { type Tx } from "../domain/subscription.repository";

/**
 * The free-tier count, read from the subscriptions side for the same reason `PrismaCategoryResolver`
 * is — see the note there. One number out, no project entity, no ownership decision.
 *
 * `deletedAt: null` is the load-bearing predicate: soft-deleted projects must not hold a free slot
 * hostage, or a user who deletes their only CV can never make another.
 */
@Injectable()
export class PrismaProjectCounter implements ProjectCounter {
  constructor(private readonly prisma: PrismaService) {}

  async countLiveFor(userId: string, category: CategoryCode, tx?: Tx): Promise<number> {
    /**
     * Accepts the transaction handle so the create use case can count **inside** its own transaction.
     *
     * That is what makes the cap hold under concurrency: two simultaneous creates counting on separate
     * connections would both read zero and both insert. Counting on the transaction's own connection
     * serialises them against the insert that follows.
     *
     * It also avoids P2024 — querying with the base client while a transaction holds the single pooled
     * connection deadlocks, which is the trap documented in `ConsumeEntitlementService`.
     */
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma;

    return client.project.count({
      where: { userId, deletedAt: null, category: { code: category } },
    });
  }

  async lockForCreate(tx: Tx, userId: string, category: CategoryCode): Promise<void> {
    const client = tx as Prisma.TransactionClient;

    /**
     * `hashtext` turns the composite key into the int4 the advisory-lock functions take. A hash
     * collision between two different (user, category) pairs is harmless: the consequence is that two
     * unrelated creates briefly serialise, not that a cap is bypassed.
     *
     * Parameterised rather than interpolated, so a user id can never reach the SQL text.
     *
     * `$executeRaw`, not `$queryRaw`: the function returns `void`, and Prisma's query path fails to
     * deserialize a void column ("Failed to deserialize column of type 'void'") — a 500 rather than a
     * lock. `$executeRaw` runs the statement and reports a row count we ignore, which is exactly the
     * semantics wanted here.
     */
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${category}`}))`;
  }
}
