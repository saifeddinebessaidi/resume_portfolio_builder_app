import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  type AdminListOrdersQuery,
  type AdminListOrdersResponse,
  type AdminMetricsOverview,
  type AdminPlansResponse,
  type AdminReasonRequest,
  type ExtendSubscriptionRequest,
  type MarkOrderPaidRequest,
  adminListOrdersQuerySchema,
  adminReasonRequestSchema,
  adminUserIdParamSchema,
  extendSubscriptionRequestSchema,
  markOrderPaidRequestSchema,
} from "@repo/contracts";

import { ADMIN_READ_MODEL, type AdminReadModel } from "../domain/admin.repository";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { ManageSubscriptionUseCase } from "../application/manage-subscription.use-case";
import { OrderSettlementUseCase } from "../application/order-settlement.use-case";
import { RequestContext } from "../../../common/context/request-context";
import { Roles } from "../../../common/decorators/roles.decorator";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { type User } from "../../users/domain/user.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

/**
 * Orders, subscriptions, plans and metrics. Mutations answer 204 and the UI re-reads the user or
 * order list, so the client never has to merge a partial response into a cached report.
 */
@Controller("admin")
@UseGuards(RolesGuard)
@Roles("ADMIN")
export class AdminOperationsController {
  constructor(
    @Inject(ADMIN_READ_MODEL) private readonly read: AdminReadModel,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settlement: OrderSettlementUseCase,
    private readonly subscriptions: ManageSubscriptionUseCase,
  ) {}

  @Get("orders")
  async orders(
    @Query(zodPipe(adminListOrdersQuerySchema)) query: AdminListOrdersQuery,
  ): Promise<AdminListOrdersResponse> {
    return this.read.listOrders(query);
  }

  @Post("orders/:id/mark-paid")
  @HttpCode(204)
  async markPaid(
    @CurrentUser() admin: User,
    @Param(zodPipe(adminUserIdParamSchema)) params: { id: string },
    @Body(zodPipe(markOrderPaidRequestSchema)) body: MarkOrderPaidRequest,
  ): Promise<void> {
    await this.settlement.markPaid({
      actorUserId: admin.id,
      orderId: params.id,
      providerRef: body.providerRef,
      reason: body.reason,
      ip: RequestContext.get().ip,
    });
  }

  @Post("orders/:id/refund")
  @HttpCode(204)
  async refund(
    @CurrentUser() admin: User,
    @Param(zodPipe(adminUserIdParamSchema)) params: { id: string },
    @Body(zodPipe(adminReasonRequestSchema)) body: AdminReasonRequest,
  ): Promise<void> {
    await this.settlement.refund({
      actorUserId: admin.id,
      orderId: params.id,
      reason: body.reason,
      ip: RequestContext.get().ip,
    });
  }

  @Post("subscriptions/:id/cancel")
  @HttpCode(204)
  async cancelSubscription(
    @CurrentUser() admin: User,
    @Param(zodPipe(adminUserIdParamSchema)) params: { id: string },
    @Body(zodPipe(adminReasonRequestSchema)) body: AdminReasonRequest,
  ): Promise<void> {
    await this.subscriptions.cancel({
      actorUserId: admin.id,
      subscriptionId: params.id,
      reason: body.reason,
      ip: RequestContext.get().ip,
    });
  }

  @Post("subscriptions/:id/extend")
  @HttpCode(204)
  async extendSubscription(
    @CurrentUser() admin: User,
    @Param(zodPipe(adminUserIdParamSchema)) params: { id: string },
    @Body(zodPipe(extendSubscriptionRequestSchema)) body: ExtendSubscriptionRequest,
  ): Promise<void> {
    await this.subscriptions.extend({
      actorUserId: admin.id,
      subscriptionId: params.id,
      days: body.days,
      reason: body.reason,
      ip: RequestContext.get().ip,
    });
  }

  @Get("plans")
  async plans(): Promise<AdminPlansResponse> {
    return { plans: await this.read.plans(this.clock.now()) };
  }

  @Get("metrics/overview")
  async metrics(): Promise<AdminMetricsOverview> {
    return this.read.metricsOverview(this.clock.now());
  }
}
