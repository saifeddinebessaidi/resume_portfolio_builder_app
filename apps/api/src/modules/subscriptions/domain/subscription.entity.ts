import {
  type CategoryCode,
  type Currency,
  type SubscriptionSource,
  type SubscriptionStatus,
} from "@repo/contracts";

/**
 * A purchased term for one category.
 *
 * The snapshot fields are not denormalisation for speed — they are the financial record. When
 * `RESUME_1M` goes from 25 to 30 TND, every existing subscription must still report what its holder
 * actually paid, or a price edit silently rewrites revenue history and every past invoice.
 */
export interface Subscription {
  id: string;
  userId: string;
  categoryId: string;
  categoryCode: CategoryCode;
  planId: string;
  status: SubscriptionStatus;
  startsAt: Date;
  endsAt: Date;
  canceledAt: Date | null;
  autoRenew: boolean;
  source: SubscriptionSource;
  orderId: string | null;
  planCodeSnapshot: string;
  priceMinorSnapshot: number;
  currencySnapshot: Currency;
  createdAt: Date;
}

/**
 * Grants access only if the status says so **and** the clock agrees.
 *
 * Both halves are required. `status = ACTIVE` alone is not enough: the nightly expiry cron might not
 * have run, the instance might have been asleep, or the row might have been activated with a
 * backdated term. Checking `now` here means an expired term stops granting access the instant it
 * lapses, with no dependency on a scheduled job having fired.
 */
export const isActiveAt = (sub: Subscription, now: Date): boolean =>
  sub.status === "ACTIVE" && sub.startsAt <= now && sub.endsAt > now;

/** True for a subscription that *was* active and whose term has run out. */
export const hasLapsed = (sub: Subscription, now: Date): boolean =>
  (sub.status === "ACTIVE" || sub.status === "EXPIRED") && sub.endsAt <= now;

export function remainingDays(sub: Subscription, now: Date): number {
  const ms = sub.endsAt.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
