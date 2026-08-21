import { Injectable } from "@nestjs/common";
import { type Prisma, type Subscription as SubscriptionRow } from "@prisma/client";
// Only these two need naming: Prisma's generated enums already are the same string unions the
// contract declares (asserted by the step 03 parity check), so `status` and `source` map across
// without a cast. `currency` needs one because @db.Char(3) types as a plain string.
import { type CategoryCode, type Currency } from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type Subscription } from "../domain/subscription.entity";
import {
  type CreateSubscriptionInput,
  type SubscriptionRepository,
  type Tx,
} from "../domain/subscription.repository";

type Row = SubscriptionRow & { category?: { code: string } | null };

/** Narrows the opaque `Tx` back to Prisma at the boundary, or falls back to the base client. */
function client(prisma: PrismaService, tx: Tx): Prisma.TransactionClient {
  return (tx as Prisma.TransactionClient | undefined) ?? prisma;
}

@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: Row, categoryCode?: CategoryCode): Subscription {
    const code = categoryCode ?? (row.category?.code as CategoryCode | undefined);
    if (!code) {
      // Every read path either includes the category or passes the code in. Reaching here means a
      // new query forgot to, which is a bug worth failing loudly rather than defaulting.
      throw new Error("Subscription mapped without its category code — include it in the query.");
    }

    return {
      id: row.id,
      userId: row.userId,
      categoryId: row.categoryId,
      categoryCode: code,
      planId: row.planId,
      status: row.status,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      canceledAt: row.canceledAt,
      autoRenew: row.autoRenew,
      source: row.source,
      orderId: row.orderId,
      planCodeSnapshot: row.planCodeSnapshot,
      priceMinorSnapshot: row.priceMinorSnapshot,
      currencySnapshot: row.currencySnapshot.trim() as Currency,
      createdAt: row.createdAt,
    };
  }

  async findActiveFor(
    userId: string,
    category: CategoryCode,
    now: Date,
  ): Promise<Subscription | null> {
    const row = await this.prisma.subscription.findFirst({
      where: {
        userId,
        category: { code: category },
        status: "ACTIVE",
        // The clock is part of the filter, not a post-check: a lapsed term must stop granting access
        // the instant it expires, whether or not the nightly cron has run.
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      include: { category: { select: { code: true } } },
    });

    return row ? this.toDomain(row) : null;
  }

  async findLatestFor(userId: string, category: CategoryCode): Promise<Subscription | null> {
    const row = await this.prisma.subscription.findFirst({
      where: { userId, category: { code: category } },
      orderBy: [{ endsAt: "desc" }, { createdAt: "desc" }],
      include: { category: { select: { code: true } } },
    });

    return row ? this.toDomain(row) : null;
  }

  async findAllFor(userId: string): Promise<Subscription[]> {
    const rows = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { category: { select: { code: true } } },
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Subscription | null> {
    const row = await this.prisma.subscription.findUnique({
      where: { id },
      include: { category: { select: { code: true } } },
    });

    return row ? this.toDomain(row) : null;
  }

  async create(tx: Tx, input: CreateSubscriptionInput): Promise<Subscription> {
    const row = await client(this.prisma, tx).subscription.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        categoryId: input.categoryId,
        status: "ACTIVE",
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        source: input.source,
        orderId: input.orderId ?? null,
        autoRenew: false,
        planCodeSnapshot: input.planCodeSnapshot,
        priceMinorSnapshot: input.priceMinorSnapshot,
        currencySnapshot: input.currencySnapshot,
      },
      include: { category: { select: { code: true } } },
    });

    return this.toDomain(row);
  }

  async cancelActiveFor(tx: Tx, userId: string, categoryId: string, at: Date): Promise<number> {
    const result = await client(this.prisma, tx).subscription.updateMany({
      where: { userId, categoryId, status: "ACTIVE" },
      data: { status: "CANCELED", canceledAt: at },
    });

    return result.count;
  }

  async expireLapsed(now: Date): Promise<number> {
    const result = await this.prisma.subscription.updateMany({
      where: { status: "ACTIVE", endsAt: { lte: now } },
      data: { status: "EXPIRED" },
    });

    return result.count;
  }
}
