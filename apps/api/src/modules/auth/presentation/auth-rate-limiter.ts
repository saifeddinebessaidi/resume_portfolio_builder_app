import { Injectable } from "@nestjs/common";

const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;

/**
 * Fixed-window attempt counter per key (IP + email), against password guessing.
 *
 * In-memory, so it is per API instance and resets on deploy — adequate for one Railway instance.
 * Move it to Postgres or Redis before scaling out horizontally.
 */
@Injectable()
export class AuthRateLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  /** Returns seconds to wait when over the limit, otherwise null (and counts the attempt). */
  hit(key: string, now = Date.now()): number | null {
    if (this.attempts.size > 10_000) this.sweep(now);

    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return null;
    }

    entry.count += 1;
    return entry.count > MAX_ATTEMPTS ? Math.ceil((entry.resetAt - now) / 1000) : null;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.attempts) if (entry.resetAt <= now) this.attempts.delete(key);
  }
}
