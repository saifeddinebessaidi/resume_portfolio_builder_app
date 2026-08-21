import { Inject, Injectable } from "@nestjs/common";
import { type OrderStatus, type PageResponse } from "@repo/contracts";

import { ORDER_REPOSITORY, type OrderRepository } from "../domain/order.repository";
import { type Order } from "../domain/order.entity";

export interface ListMyOrdersQuery {
  userId: string;
  status?: OrderStatus | undefined;
  cursor?: string | undefined;
  limit: number;
}

/**
 * The billing history behind the account screen.
 *
 * Cursor-paginated like every other list in the application: an order list grows monotonically
 * and is read while new rows are being inserted, which is exactly where offset pagination skips
 * and double-counts.
 */
@Injectable()
export class ListMyOrdersUseCase {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  execute(query: ListMyOrdersQuery): Promise<PageResponse<Order>> {
    return this.orders.listForUser(query);
  }
}
