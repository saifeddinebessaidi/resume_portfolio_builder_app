import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from "@nestjs/common";
import {
  IDEMPOTENCY_KEY_HEADER,
  type CreateOrderRequest,
  type ListOrdersQuery,
  type ListOrdersResponse,
  type Order as OrderResponse,
  createOrderRequestSchema,
  idempotencyKeySchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
} from "@repo/contracts";

import { CancelOrderUseCase } from "../application/cancel-order.use-case";
import { CreateOrderUseCase } from "../application/create-order.use-case";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { GetOrderUseCase } from "../application/get-order.use-case";
import { ListMyOrdersUseCase } from "../application/list-my-orders.use-case";
import { RequestContext } from "../../../common/context/request-context";
import { amountExclTax, totalTax, type Order } from "../domain/order.entity";
import { type User } from "../../users/domain/user.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

/**
 * Orders are **not** entitlement-gated.
 *
 * Deliberate, and the opposite of the projects controller: buying is how a user acquires
 * entitlements in the first place, so requiring one to place an order would be circular.
 */
@Controller("orders")
export class OrdersController {
  constructor(
    private readonly createOrder: CreateOrderUseCase,
    private readonly listMine: ListMyOrdersUseCase,
    private readonly getOrder: GetOrderUseCase,
    private readonly cancelOrder: CancelOrderUseCase,
  ) {}

  /**
   * The tax split is computed here from the order's own snapshot, never from live configuration —
   * so re-rendering a two-year-old order shows the VAT rate that applied when it was placed.
   */
  private toResponse(order: Order): OrderResponse {
    const currency = order.currency;

    return {
      id: order.id,
      status: order.status,
      categoryCode: order.categoryCode,
      planCode: order.planCodeSnapshot,
      // The snapshot holds the code, not the display name, so the code stands in. Joining to the
      // live plan would put a renamed plan's label onto a historical financial record.
      planName: order.planCodeSnapshot,
      amount: { amountMinor: order.amountMinor, currency },
      taxRateBp: order.taxRateBp,
      amountExclTax: { amountMinor: amountExclTax(order), currency },
      taxAmount: { amountMinor: totalTax(order), currency },
      invoiceNumber: order.invoiceNumber,
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }

  /**
   * `Idempotency-Key` is optional but strongly recommended, and the checkout UI always sends one.
   *
   * Validated rather than trusted: an empty or one-character key would deduplicate every order a
   * buggy client ever places into the first one, which is a far worse failure than rejecting it.
   */
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: User,
    @Body(zodPipe(createOrderRequestSchema)) body: CreateOrderRequest,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey?: string,
  ): Promise<OrderResponse> {
    // Through the pipe, not `schema.parse`: a raw ZodError escaping a controller is a 500, and a
    // malformed header deserves the same 422 with a field breakdown as a malformed body.
    const key = idempotencyKey
      ? zodPipe(idempotencyKeySchema).transform(idempotencyKey)
      : undefined;

    const order = await this.createOrder.execute({
      userId: user.id,
      planCode: body.planCode,
      idempotencyKey: key,
    });

    return this.toResponse(order);
  }

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query(zodPipe(listOrdersQuerySchema)) query: ListOrdersQuery,
  ): Promise<ListOrdersResponse> {
    const page = await this.listMine.execute({
      userId: user.id,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });

    return { items: page.items.map((o) => this.toResponse(o)), nextCursor: page.nextCursor };
  }

  @Get(":id")
  async detail(
    @CurrentUser() user: User,
    @Param(zodPipe(orderIdParamSchema)) params: { id: string },
  ): Promise<OrderResponse> {
    return this.toResponse(await this.getOrder.execute(params.id, user.id));
  }

  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(
    @CurrentUser() user: User,
    @Param(zodPipe(orderIdParamSchema)) params: { id: string },
  ): Promise<OrderResponse> {
    const order = await this.cancelOrder.execute({
      orderId: params.id,
      userId: user.id,
      ip: RequestContext.get().ip,
    });

    return this.toResponse(order);
  }
}
