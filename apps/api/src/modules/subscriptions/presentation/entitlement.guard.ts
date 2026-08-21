import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type CategoryCode, categoryCodeSchema } from "@repo/contracts";

import {
  EntitlementExhaustedError,
  NoActiveSubscriptionError,
  SubscriptionExpiredError,
} from "../../../common/errors/errors";
import { hasHeadroom } from "../domain/entitlement";
import { type RequestWithUser } from "../../../common/guards/auth.guard";
import { ResolveEntitlementsUseCase } from "../application/resolve-entitlements.use-case";
import {
  REQUIRE_ENTITLEMENT_KEY,
  type RequireEntitlementOptions,
} from "./require-entitlement.decorator";
import { CATEGORY_RESOLVER, type CategoryResolver } from "../domain/category-resolver.port";
import { Inject } from "@nestjs/common";

/**
 * Rejects a request that obviously cannot succeed, before any work is done.
 *
 * **This guard is not the authority, and must not be treated as one.** Two reasons, both structural:
 * it runs outside the mutation's transaction, and between its read and the write a concurrent request
 * can spend the last unit. `ConsumeEntitlementService` inside the use case's transaction is the real
 * gate.
 *
 * Its job is user experience and cost: a precise 403 carrying `limit`, `used` and `resetsAt` instead
 * of a generic failure after the server has already done the work. A future reader will reasonably
 * assume the guard is sufficient and be tempted to drop the use-case check as redundant — it is not,
 * and removing it reopens the double-spend the counter's unique constraint exists to close.
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolve: ResolveEntitlementsUseCase,
    @Inject(CATEGORY_RESOLVER) private readonly categories: CategoryResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RequireEntitlementOptions>(
      REQUIRE_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) return true;

    const req = context
      .switchToHttp()
      .getRequest<RequestWithUser & { body?: unknown; params?: Record<string, string> }>();

    // The global AuthGuard has already run, so a missing user here means the route is @Public() and
    // @RequireEntitlement() at once — a contradiction, not a client error.
    if (!req.user) {
      throw new Error("@RequireEntitlement() on a route with no authenticated user.");
    }

    const category = await this.categoryFor(options, req);

    // No category means the request cannot be evaluated here. Let it through: the Zod pipe will
    // reject a malformed body with a field-level 422, which is a better error than a guard's guess,
    // and the use case still enforces the quota.
    if (!category) return true;

    const state = await this.resolve.execute(req.user.id, category);

    if (!state.subscription) {
      throw state.blockedReason === "SUBSCRIPTION_EXPIRED"
        ? new SubscriptionExpiredError(category, new Date())
        : new NoActiveSubscriptionError(category);
    }

    const entitlement = state.entitlements.find((e) => e.key === options.key);

    // Deny by default: a plan that does not declare the key grants none of it.
    if (!entitlement) {
      throw new EntitlementExhaustedError(options.key, 0, 0, null, category);
    }

    if (!hasHeadroom(entitlement)) {
      throw new EntitlementExhaustedError(
        options.key,
        entitlement.limit ?? 0,
        entitlement.used ?? 0,
        entitlement.resetsAt,
        category,
      );
    }

    return true;
  }

  private async categoryFor(
    options: RequireEntitlementOptions,
    req: { body?: unknown; params?: Record<string, string> },
  ): Promise<CategoryCode | null> {
    if (options.categoryFrom === "body") {
      const raw = (req.body as { categoryCode?: unknown } | undefined)?.categoryCode;
      const parsed = categoryCodeSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    }

    const projectId = req.params?.id;
    if (!projectId) return null;

    // Via a port, so the subscriptions module does not import the projects module — that would make
    // the two mutually dependent, since projects consumes entitlements.
    return this.categories.categoryOfProject(projectId);
  }
}
