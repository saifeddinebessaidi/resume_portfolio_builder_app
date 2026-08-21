import { type Currency, type OrderStatus, type PageResponse } from "@repo/contracts";

import { type Tx } from "../../subscriptions/domain/subscription.repository";
import { type Order } from "./order.entity";

export const ORDER_REPOSITORY = Symbol("ORDER_REPOSITORY");

export interface CreateOrderInput {
  userId: string;
  planId: string;
  categoryId: string;
  amountMinor: number;
  currency: Currency;
  taxRateBp: number;
  planCodeSnapshot: string;
  idempotencyKey: string | null;
}

export interface ListOrdersQuery {
  userId: string;
  status?: OrderStatus | undefined;
  cursor?: string | undefined;
  limit: number;
}

export interface OrderRepository {
  create(tx: Tx, input: CreateOrderInput): Promise<Order>;

  /**
   * **Always scoped by `userId`, in the query.** Not a guard on top of an unscoped read: an
   * ownership check that lives only in a guard is one forgotten decorator away from serving
   * another customer's order — and an order carries a name, a price and an invoice number.
   */
  findByIdForUser(id: string, userId: string): Promise<Order | null>;

  /** Unscoped, for the admin surface and the cron. Never reachable from a user-facing route. */
  findById(id: string, tx?: Tx): Promise<Order | null>;

  listForUser(query: ListOrdersQuery): Promise<PageResponse<Order>>;

  /**
   * The transition to PAID, with its invoice number, as one statement.
   *
   * `where` includes `status: 'PENDING'`, so two concurrent callers cannot both succeed: the
   * second updates zero rows and gets `null` back. That is the database enforcing the state
   * machine underneath the entity's assertion, not instead of it — the assertion gives the caller
   * a meaningful error, this makes the race impossible.
   */
  markPaid(
    tx: Tx,
    args: { orderId: string; invoiceNumber: string; paidAt: Date },
  ): Promise<Order | null>;

  /** Same conditional-update shape as `markPaid`, for FAILED / CANCELED / REFUNDED. */
  transition(
    tx: Tx,
    args: { orderId: string; from: OrderStatus; to: OrderStatus },
  ): Promise<Order | null>;

  /**
   * `PENDING` orders older than the cutoff, for the nightly sweep. Returned rather than updated
   * in bulk so each cancellation can be audited individually.
   */
  findStalePending(olderThan: Date, limit: number): Promise<Order[]>;
}
