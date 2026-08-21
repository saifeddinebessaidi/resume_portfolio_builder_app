import { type ResetPeriod } from "@repo/contracts";

import { type Subscription } from "./subscription.entity";

export interface PeriodWindow {
  start: Date;
  end: Date;
}

/**
 * The business timezone. Calendar-month boundaries are computed against it, so "resets on the 1st"
 * means the 1st where the customer lives, not wherever the API happens to be deployed.
 *
 * Tunisia is UTC+1 year round with no daylight saving, which is why a fixed offset is honest here
 * rather than a lurking bug — a country with DST would need a real timezone library.
 */
export const BUSINESS_UTC_OFFSET_HOURS = 1;

/** First instant of the calendar month containing `at`, in business time, expressed as UTC. */
export function startOfBusinessMonth(at: Date): Date {
  const shifted = new Date(at.getTime() + BUSINESS_UTC_OFFSET_HOURS * 3_600_000);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      1,
      -BUSINESS_UTC_OFFSET_HOURS,
      0,
      0,
      0,
    ),
  );
}

/** First instant of the following calendar month — the exclusive end of the window. */
export function startOfNextBusinessMonth(at: Date): Date {
  const shifted = new Date(at.getTime() + BUSINESS_UTC_OFFSET_HOURS * 3_600_000);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      1,
      -BUSINESS_UTC_OFFSET_HOURS,
      0,
      0,
      0,
    ),
  );
}

/**
 * Which window a `UsageCounter` row meters, for a given reset period.
 *
 * A pure function with no I/O, which is why the awkward calendar arithmetic above is safe to have:
 * it is trivially testable in isolation, and phase 9 pins the month-boundary cases.
 *
 * **`MONTHLY` is a calendar month, not a rolling 30 days.** A rolling window is unexplainable to a
 * customer — "you used one on the 4th, so you get one back on the 4th" — and generates support
 * tickets. Calendar months reset predictably on the 1st, which the UI can state plainly.
 *
 * **`NONE` returns `null`** because those limits are counted on the resource itself
 * (`Project.revisionCount`, `count(ProjectExport)`), not in a counter row. One engine, two counting
 * sources, selected by this value.
 */
export function periodWindowFor(
  reset: ResetPeriod,
  subscription: Subscription,
  now: Date,
): PeriodWindow | null {
  switch (reset) {
    case "MONTHLY":
      return { start: startOfBusinessMonth(now), end: startOfNextBusinessMonth(now) };

    case "TERM":
      // One allowance for the whole term. Using the subscription's own dates means a renewal
      // creates a new window automatically, with no cron and no reset job.
      return { start: subscription.startsAt, end: subscription.endsAt };

    case "NONE":
      return null;
  }
}
