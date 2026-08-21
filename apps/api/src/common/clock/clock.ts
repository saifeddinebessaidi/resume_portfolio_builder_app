export const CLOCK = Symbol("CLOCK");

/**
 * Time as a dependency.
 *
 * Every "is this subscription still active", "which calendar month is this" and "when does the term
 * end" question routes through here, so a test can decide it is the 31st of a month or one second
 * after a term expired without waiting or mocking the global `Date`.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** For tests: a clock that can be moved. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(at: Date): void {
    this.current = at;
  }

  advanceDays(days: number): void {
    const next = new Date(this.current);
    next.setUTCDate(next.getUTCDate() + days);
    this.current = next;
  }
}
