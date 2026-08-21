import { Inject, Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../common/errors/errors";
import { ORDER_REPOSITORY, type OrderRepository } from "../domain/order.repository";
import { type Order } from "../domain/order.entity";

/**
 * Another user's order id returns 404, not 403.
 *
 * Deliberately indistinguishable from a genuinely missing order: 403 would confirm that an order
 * with that id exists, which is an enumeration oracle over the revenue table. The repository
 * scopes on `userId` in the query and simply never finds it.
 */
@Injectable()
export class GetOrderUseCase {
  constructor(@Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository) {}

  async execute(id: string, userId: string): Promise<Order> {
    const order = await this.orders.findByIdForUser(id, userId);
    if (!order) throw new NotFoundError("Cette commande est introuvable.");
    return order;
  }
}
