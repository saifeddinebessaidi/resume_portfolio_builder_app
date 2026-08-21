import { type CategoryCode, type Currency, type SubscriptionSource } from "@repo/contracts";

import { type Subscription } from "./subscription.entity";

export const SUBSCRIPTION_REPOSITORY = Symbol("SUBSCRIPTION_REPOSITORY");
export const USAGE_COUNTER_REPOSITORY = Symbol("USAGE_COUNTER_REPOSITORY");

/**
 * A transaction handle, as far as the inner layers are concerned.
 *
 * Deliberately opaque: `application/` must be able to say "do these two writes together" without
 * importing `Prisma.TransactionClient`, which would drag Prisma across the boundary. The Prisma
 * repositories narrow it back at the edge.
 */
export type Tx = unknown;

export interface CreateSubscriptionInput {
  userId: string;
  planId: string;
  categoryId: string;
  startsAt: Date;
  endsAt: Date;
  source: SubscriptionSource;
  orderId?: string | null;
  planCodeSnapshot: string;
  priceMinorSnapshot: number;
  currencySnapshot: Currency;
}

export interface SubscriptionRepository {
  /**
   * The hottest read in the application: it runs on every mutation. Filters on status **and** the
   * clock, so a lapsed term stops granting access without waiting for the expiry cron.
   */
  findActiveFor(userId: string, category: CategoryCode, now: Date): Promise<Subscription | null>;

  /**
   * The most recent subscription for a category regardless of status, so the UI can distinguish
   * "never subscribed" (`NO_ACTIVE_SUBSCRIPTION`) from "it ran out" (`SUBSCRIPTION_EXPIRED`) — two
   * different messages and two different conversion prompts.
   */
  findLatestFor(userId: string, category: CategoryCode): Promise<Subscription | null>;

  findAllFor(userId: string): Promise<Subscription[]>;

  findById(id: string): Promise<Subscription | null>;

  create(tx: Tx, input: CreateSubscriptionInput): Promise<Subscription>;

  /**
   * Moves any ACTIVE row for this (user, category) to CANCELED.
   *
   * Must run in the same transaction as the create that follows it, or the partial unique index
   * rejects the insert — which is the index doing its job, but produces a 409 for what should be a
   * legitimate plan switch.
   */
  cancelActiveFor(tx: Tx, userId: string, categoryId: string, at: Date): Promise<number>;

  /** The nightly expiry sweep (phase 7 step 04). Returns how many rows moved. */
  expireLapsed(now: Date): Promise<number>;
}

export interface UsageSnapshot {
  key: string;
  periodStart: Date;
  periodEnd: Date;
  used: number;
}

export interface UsageCounterRepository {
  /** Read-only, for resolution and the dashboard. */
  findForSubscription(subscriptionId: string): Promise<UsageSnapshot[]>;

  /**
   * **Increment first, return the new value.** The composite unique constraint
   * `(subscriptionId, key, periodStart)` makes concurrent callers serialise on the row lock, which
   * is what makes the caller's post-increment check a real gate rather than a hopeful one.
   *
   * Must be called with a transaction handle, inside the same transaction as the mutation being
   * authorized — otherwise the increment can commit while the mutation rolls back, and the user has
   * paid for something they did not get.
   */
  incrementAndRead(
    tx: Tx,
    args: { subscriptionId: string; key: string; periodStart: Date; periodEnd: Date },
  ): Promise<number>;
}
