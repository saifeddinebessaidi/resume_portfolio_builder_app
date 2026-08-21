import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
  type GrantSubscriptionRequest,
  type Subscription as SubscriptionResponse,
  grantSubscriptionRequestSchema,
} from "@repo/contracts";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { GrantSubscriptionUseCase } from "../application/grant-subscription.use-case";
import { RequestContext } from "../../../common/context/request-context";
import { Roles } from "../../../common/decorators/roles.decorator";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { type User } from "../../users/domain/user.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

/**
 * `RolesGuard` is applied here rather than globally: only `/admin/**` needs it, and a global roles
 * guard would have to special-case every other route in the application.
 */
@Controller("admin/subscriptions")
@UseGuards(RolesGuard)
@Roles("ADMIN")
export class AdminSubscriptionsController {
  constructor(private readonly grant: GrantSubscriptionUseCase) {}

  @Post("grant")
  @HttpCode(201)
  async grantSubscription(
    @CurrentUser() admin: User,
    @Body(zodPipe(grantSubscriptionRequestSchema)) body: GrantSubscriptionRequest,
  ): Promise<SubscriptionResponse> {
    const subscription = await this.grant.execute({
      actorUserId: admin.id,
      targetUserId: body.userId,
      planCode: body.planCode,
      ...(body.startsAt ? { startsAt: new Date(body.startsAt) } : {}),
      note: body.note,
      // Recorded on the audit row: a free grant should be traceable to where it came from.
      ip: RequestContext.get().ip,
    });

    return {
      id: subscription.id,
      categoryCode: subscription.categoryCode,
      status: subscription.status,
      planCode: subscription.planCodeSnapshot,
      planName: subscription.planCodeSnapshot,
      price: {
        amountMinor: subscription.priceMinorSnapshot,
        currency: subscription.currencySnapshot,
      },
      startsAt: subscription.startsAt.toISOString(),
      endsAt: subscription.endsAt.toISOString(),
      canceledAt: subscription.canceledAt?.toISOString() ?? null,
      autoRenew: subscription.autoRenew,
      source: subscription.source,
      createdAt: subscription.createdAt.toISOString(),
    };
  }
}
