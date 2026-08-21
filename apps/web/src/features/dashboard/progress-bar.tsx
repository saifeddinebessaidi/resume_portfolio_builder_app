import type { ReactNode } from "react";

import { messages } from "@/messages/fr";

/**
 * How complete a project is, as a bar plus its number.
 *
 * ## Why it replaced the revisions column
 *
 * That column read `revisionCount / revisionLimit` — a count of saves against a cap that ADR-0013
 * removed. It answered "how many times have you pressed save", which tells a user nothing they want to
 * know and, with autosave now writing on every field blur, climbs on its own. **Progress answers the
 * question they actually have**: is this CV finished enough to send?
 *
 * ## The colour is the message
 *
 * Three bands, and the thresholds are chosen from what the number *means* rather than for even
 * spacing — the weights in `resumeCompletion` are what make them meaningful:
 *
 * - **< 40% — danger.** The identity block and the experience section cannot both be present, so this
 *   is not yet a document anyone could read.
 * - **40–79% — warning.** Recognisably a CV, with something substantive still missing.
 * - **≥ 80% — success.** Everything a reader needs; the remainder is polish.
 *
 * Colour is never the only carrier: the percentage is printed beside the bar and repeated in
 * `aria-valuenow`, so the bar is redundant for anyone who cannot distinguish the hues.
 */
const BANDS = [
  // The same three tokens `Badge` uses for success / warning / danger, so a green bar and a green badge
  // in the same row are the same green.
  { min: 80, className: "bg-[var(--cyan)]" },
  { min: 40, className: "bg-[var(--accent)]" },
  { min: 0, className: "bg-[var(--destructive)]" },
] as const;

/**
 * The `min: 0` band matches any non-negative value, so `find` always succeeds — but
 * `noUncheckedIndexedAccess` cannot know that, and the fallback spells out the intent rather than
 * asserting it away.
 */
const bandFor = (percent: number): string =>
  BANDS.find((b) => percent >= b.min)?.className ?? "bg-[var(--destructive)]";

export function ProgressBar({
  percent,
  /** Names what is being measured, for a screen reader reading the bar out of context. */
  label,
}: {
  percent: number;
  label: string;
}): ReactNode {
  // Clamped rather than trusted: the field is server-computed and bounded by the contract, but a bar
  // wider than its track would break the row layout, and that is a silly way to find out about a bug.
  const value = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--foreground)_12%,transparent)]"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${bandFor(value)}`}
          style={{ width: `${String(value)}%` }}
        />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground">
        {messages.quota.percent(value)}
      </span>
    </div>
  );
}
