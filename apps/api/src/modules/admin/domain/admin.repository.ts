import {
  type AccessFeature,
  type AccessOverride,
  type AdminListOrdersQuery,
  type AdminListUsersQuery,
  type AdminMetricsOverview,
  type AdminOrder,
  type AdminPlan,
  type AdminUserListItem,
  type EntitlementKey,
  type EntitlementOverride,
  type PageResponse,
  type UserRole,
  type UserStatus,
} from "@repo/contracts";

import { type Tx } from "../../subscriptions/domain/subscription.repository";
import { type User } from "../../users/domain/user.entity";

export const ADMIN_READ_MODEL = Symbol("ADMIN_READ_MODEL");
export const ADMIN_REPOSITORY = Symbol("ADMIN_REPOSITORY");

/**
 * The admin screens' queries. Returns wire shapes directly: these are cross-aggregate reports
 * (a user with their subscriptions, orders and payments), not domain objects anything mutates, and
 * routing them through entities would only add a mapping layer per screen.
 */
export interface AdminReadModel {
  listUsers(query: AdminListUsersQuery, now: Date): Promise<PageResponse<AdminUserListItem>>;
  listOrders(query: AdminListOrdersQuery): Promise<PageResponse<AdminOrder>>;
  ordersForUser(userId: string): Promise<AdminOrder[]>;
  accessOverridesFor(userId: string): Promise<AccessOverride[]>;
  entitlementOverridesFor(userId: string): Promise<EntitlementOverride[]>;
  plans(now: Date): Promise<AdminPlan[]>;
  metricsOverview(now: Date): Promise<AdminMetricsOverview>;
}

export interface AccessOverrideState {
  enabled: boolean;
  reason: string | null;
}

export interface EntitlementOverrideState {
  limitValue: number | null;
  reason: string | null;
}

/**
 * The admin-only writes. Every method takes the transaction so the matching AuditLog row commits
 * or rolls back with it.
 */
export interface AdminRepository {
  /**
   * Serialises every role/status change. Without it two admins demoting each other at the same
   * moment would each count two admins, both succeed, and leave none.
   */
  lockAdminRoster(tx: Tx): Promise<void>;
  countActiveAdmins(tx: Tx): Promise<number>;
  updateUser(tx: Tx, id: string, patch: { role?: UserRole; status?: UserStatus }): Promise<User>;

  findAccessOverride(
    tx: Tx,
    userId: string,
    feature: AccessFeature,
  ): Promise<AccessOverrideState | null>;
  upsertAccessOverride(
    tx: Tx,
    input: {
      userId: string;
      feature: AccessFeature;
      enabled: boolean;
      reason: string;
      actorId: string;
    },
  ): Promise<void>;
  deleteAccessOverride(tx: Tx, userId: string, feature: AccessFeature): Promise<void>;

  findEntitlementOverride(
    tx: Tx,
    userId: string,
    categoryId: string,
    key: EntitlementKey,
  ): Promise<EntitlementOverrideState | null>;
  upsertEntitlementOverride(
    tx: Tx,
    input: {
      userId: string;
      categoryId: string;
      key: EntitlementKey;
      limitValue: number | null;
      reason: string;
      actorId: string;
    },
  ): Promise<void>;
  deleteEntitlementOverride(
    tx: Tx,
    userId: string,
    categoryId: string,
    key: EntitlementKey,
  ): Promise<void>;

  /** Conditional on ACTIVE; returns false when there was nothing to cancel. */
  cancelSubscription(tx: Tx, id: string, at: Date): Promise<boolean>;
  setSubscriptionEndsAt(tx: Tx, id: string, endsAt: Date): Promise<void>;
  findSubscriptionIdByOrder(tx: Tx, orderId: string): Promise<string | null>;
}
