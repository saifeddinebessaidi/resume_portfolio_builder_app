import { Controller, Get } from "@nestjs/common";
import {
  CATEGORY_CODES,
  type CategoryCode,
  type CategoryEntitlements,
  type EntitlementsResponse,
  type ResolvedEntitlement as ResolvedEntitlementResponse,
  type Subscription as SubscriptionResponse,
  type SubscriptionsResponse,
} from "@repo/contracts";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { ListMySubscriptionsUseCase } from "../application/list-my-subscriptions.use-case";
import { FeatureAccessService } from "../application/feature-access.service";
import {
  type CategoryEntitlementState,
  ResolveEntitlementsUseCase,
} from "../application/resolve-entitlements.use-case";
import { type ResolvedEntitlement } from "../domain/entitlement";
import { type Subscription } from "../domain/subscription.entity";
import { type User } from "../../users/domain/user.entity";

/** Shared by this controller and the dashboard summary, so both render identical numbers. */
export function toResolvedEntitlementResponse(
  entitlement: ResolvedEntitlement,
): ResolvedEntitlementResponse {
  return {
    key: entitlement.key,
    limit: entitlement.limit,
    used: entitlement.used,
    remaining: entitlement.remaining,
    resetPeriod: entitlement.resetPeriod,
    resetsAt: entitlement.resetsAt?.toISOString() ?? null,
  };
}

export function toSubscriptionResponse(sub: Subscription, planName: string): SubscriptionResponse {
  return {
    id: sub.id,
    categoryCode: sub.categoryCode,
    status: sub.status,
    // The snapshots, not a join to the live plan: a price edit must never rewrite history.
    planCode: sub.planCodeSnapshot,
    planName,
    price: { amountMinor: sub.priceMinorSnapshot, currency: sub.currencySnapshot },
    startsAt: sub.startsAt.toISOString(),
    endsAt: sub.endsAt.toISOString(),
    canceledAt: sub.canceledAt?.toISOString() ?? null,
    autoRenew: sub.autoRenew,
    source: sub.source,
    createdAt: sub.createdAt.toISOString(),
  };
}

/** Shared with the admin user detail, so an admin sees exactly what the user's own screen shows. */
export function toCategoryEntitlementsResponse(
  code: CategoryCode,
  state: CategoryEntitlementState | undefined,
): CategoryEntitlements {
  if (!state) {
    return {
      categoryCode: code,
      subscription: null,
      entitlements: [],
      canCreate: false,
      blockedReason: "NO_ACTIVE_SUBSCRIPTION",
    };
  }

  return {
    categoryCode: code,
    subscription: state.subscription
      ? {
          status: state.subscription.status,
          planCode: state.subscription.planCodeSnapshot,
          planName: state.planName ?? state.subscription.planCodeSnapshot,
          endsAt: state.subscription.endsAt.toISOString(),
        }
      : null,
    entitlements: state.entitlements.map(toResolvedEntitlementResponse),
    canCreate: state.canCreate,
    blockedReason: state.blockedReason,
  };
}

@Controller()
export class SubscriptionsController {
  constructor(
    private readonly listMine: ListMySubscriptionsUseCase,
    private readonly resolve: ResolveEntitlementsUseCase,
    private readonly featureAccess: FeatureAccessService,
  ) {}

  @Get("subscriptions")
  async list(@CurrentUser() user: User): Promise<SubscriptionsResponse> {
    const subs = await this.listMine.execute(user.id);

    return {
      // The catalog's display name, resolved in the use case. The code still travels as `planCode`.
      subscriptions: subs.map((s) => toSubscriptionResponse(s.subscription, s.planName)),
    };
  }

  /**
   * The same resolved shape the guards use, so a client can grey out a button before the user clicks.
   * A convenience, never the authority — the server re-checks on every mutation.
   */
  @Get("subscriptions/entitlements")
  async entitlements(@CurrentUser() user: User): Promise<EntitlementsResponse> {
    const [states, disabledFeatures] = await Promise.all([
      this.resolve.executeAll(user.id, [...CATEGORY_CODES]),
      this.featureAccess.disabledFeatures(user.id),
    ]);

    return {
      disabledFeatures,
      categories: CATEGORY_CODES.map((code) =>
        toCategoryEntitlementsResponse(code, states.get(code)),
      ),
    };
  }
}
