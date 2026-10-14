import { Inject, Injectable } from "@nestjs/common";
import {
  type AccessOverride,
  type AdminOrder,
  CATEGORY_CODES,
  type CategoryCode,
  type EntitlementOverride,
} from "@repo/contracts";

import { ADMIN_READ_MODEL, type AdminReadModel } from "../domain/admin.repository";
import {
  type CategoryEntitlementState,
  ResolveEntitlementsUseCase,
} from "../../subscriptions/application/resolve-entitlements.use-case";
import { ListMySubscriptionsUseCase } from "../../subscriptions/application/list-my-subscriptions.use-case";
import { NotFoundError } from "../../../common/errors/errors";
import { type Subscription } from "../../subscriptions/domain/subscription.entity";
import { type User } from "../../users/domain/user.entity";
import { USER_REPOSITORY, type UserRepository } from "../../users/domain/user.repository";

export interface AdminUserDetailState {
  user: User;
  subscriptions: { subscription: Subscription; planName: string }[];
  orders: AdminOrder[];
  entitlements: Map<CategoryCode, CategoryEntitlementState>;
  accessOverrides: AccessOverride[];
  entitlementOverrides: EntitlementOverride[];
}

/**
 * Everything about one user on one screen. Entitlements come from the same use case the user's own
 * dashboard calls, so what the admin sees — overrides applied — is exactly what enforcement sees.
 */
@Injectable()
export class GetAdminUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ADMIN_READ_MODEL) private readonly read: AdminReadModel,
    private readonly listSubscriptions: ListMySubscriptionsUseCase,
    private readonly resolve: ResolveEntitlementsUseCase,
  ) {}

  async execute(userId: string): Promise<AdminUserDetailState> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError("Cet utilisateur est introuvable.");

    const [subscriptions, orders, entitlements, accessOverrides, entitlementOverrides] =
      await Promise.all([
        this.listSubscriptions.execute(userId),
        this.read.ordersForUser(userId),
        this.resolve.executeAll(userId, [...CATEGORY_CODES]),
        this.read.accessOverridesFor(userId),
        this.read.entitlementOverridesFor(userId),
      ]);

    return { user, subscriptions, orders, entitlements, accessOverrides, entitlementOverrides };
  }
}
