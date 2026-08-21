import { Injectable } from "@nestjs/common";
import { type Order as OrderRow, type Prisma } from "@prisma/client";
import {
  type CategoryCode,
  type Currency,
  type OrderStatus,
  type PageResponse,
} from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { cursorWhere, decodeCursor, paginate } from "../../../common/pagination/cursor";
import { type Order } from "../domain/order.entity";
import {
  type CreateOrderInput,
  type ListOrdersQuery,
  type OrderRepository,
} from "../domain/order.repository";
import { type Tx } from "../../subscriptions/domain/subscription.repository";

/** Every read includes the category, because the domain entity carries the code, not just the id. */
const ORDER_INCLUDE = { category: { select: { code: true } } } as const;

type Row = OrderRow & { category: { code: string } };

/** Narrows the opaque `Tx` back to Prisma at the boundary, or falls back to the base client. */
function client(prisma: PrismaService, tx: Tx): Prisma.TransactionClient {
  return (tx as Prisma.TransactionClient | undefined) ?? prisma;
}

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: Row): Order {
    return {
      id: row.id,
      userId: row.userId,
      planId: row.planId,
      categoryId: row.categoryId,
      categoryCode: row.category.code as CategoryCode,
      status: row.status,
      amountMinor: row.amountMinor,
      // @db.Char(3) is blank-padded by Postgres, so it arrives as "TND" only by luck of length.
      // Trimming makes that explicit rather than relying on every currency code being 3 characters.
      currency: row.currency.trim() as Currency,
      taxRateBp: row.taxRateBp,
      planCodeSnapshot: row.planCodeSnapshot,
      invoiceNumber: row.invoiceNumber,
      paidAt: row.paidAt,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async create(tx: Tx, input: CreateOrderInput): Promise<Order> {
    const row = await client(this.prisma, tx).order.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        categoryId: input.categoryId,
        status: "PENDING",
        amountMinor: input.amountMinor,
        currency: input.currency,
        taxRateBp: input.taxRateBp,
        planCodeSnapshot: input.planCodeSnapshot,
        idempotencyKey: input.idempotencyKey,
      },
      include: ORDER_INCLUDE,
    });

    return this.toDomain(row);
  }

  async findByIdForUser(id: string, userId: string): Promise<Order | null> {
    // `userId` is in the WHERE clause, not checked after the fact: an ownership test that lives
    // only in a guard is one forgotten decorator away from serving another customer's order.
    const row = await this.prisma.order.findFirst({
      where: { id, userId },
      include: ORDER_INCLUDE,
    });

    return row ? this.toDomain(row) : null;
  }

  async findById(id: string, tx?: Tx): Promise<Order | null> {
    const row = await client(this.prisma, tx).order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    return row ? this.toDomain(row) : null;
  }

  async listForUser(query: ListOrdersQuery): Promise<PageResponse<Order>> {
    const cursor = decodeCursor(query.cursor);

    const rows = await this.prisma.order.findMany({
      where: {
        userId: query.userId,
        ...(query.status ? { status: query.status } : {}),
        ...cursorWhere(cursor),
      },
      // Must match the cursor's sort exactly, or a page boundary silently drops rows.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      include: ORDER_INCLUDE,
    });

    const page = paginate(rows, query.limit);

    return { items: page.items.map((r) => this.toDomain(r)), nextCursor: page.nextCursor };
  }

  /**
   * `updateMany` with the status in the WHERE clause, then a read — not `update`.
   *
   * The conditional predicate is the point: two concurrent transitions to PAID cannot both match,
   * so the second updates zero rows and returns null instead of overwriting the first's invoice
   * number. A plain `update` by id would happily apply both.
   */
  async markPaid(
    tx: Tx,
    args: { orderId: string; invoiceNumber: string; paidAt: Date },
  ): Promise<Order | null> {
    const db = client(this.prisma, tx);

    const result = await db.order.updateMany({
      where: { id: args.orderId, status: "PENDING" },
      data: { status: "PAID", invoiceNumber: args.invoiceNumber, paidAt: args.paidAt },
    });

    if (result.count === 0) return null;

    const row = await db.order.findUnique({ where: { id: args.orderId }, include: ORDER_INCLUDE });

    return row ? this.toDomain(row) : null;
  }

  async transition(
    tx: Tx,
    args: { orderId: string; from: OrderStatus; to: OrderStatus },
  ): Promise<Order | null> {
    const db = client(this.prisma, tx);

    const result = await db.order.updateMany({
      where: { id: args.orderId, status: args.from },
      data: { status: args.to },
    });

    if (result.count === 0) return null;

    const row = await db.order.findUnique({ where: { id: args.orderId }, include: ORDER_INCLUDE });

    return row ? this.toDomain(row) : null;
  }

  async findStalePending(olderThan: Date, limit: number): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { status: "PENDING", createdAt: { lt: olderThan } },
      // Oldest first: if a backlog exceeds the batch limit, the most abandoned go first.
      orderBy: { createdAt: "asc" },
      take: limit,
      include: ORDER_INCLUDE,
    });

    return rows.map((r) => this.toDomain(r));
  }
}
