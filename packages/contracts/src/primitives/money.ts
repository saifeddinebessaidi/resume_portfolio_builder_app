import { z } from "zod";

/**
 * The exponent table. **This is the only place in the codebase that knows how many decimal
 * places a currency has**, and the only place allowed to divide by it.
 *
 * TND has THREE decimals — 1 dinar = 1000 millimes — so 25 TND is stored as 25000. A `/100`
 * written anywhere else renders that as "250.00", which looks like a formatting bug while
 * actually being a data error. See ADR-0006.
 */
export const CURRENCY_EXPONENT = {
  TND: 3,
  EUR: 2,
  USD: 2,
} as const;

export const Currency = {
  TND: "TND",
  EUR: "EUR",
  USD: "USD",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];

export const currencySchema = z.enum(Currency);

export const moneySchema = z.object({
  /** Integer minor units. Never a float, never a formatted string. */
  amountMinor: z.number().int(),
  currency: currencySchema,
});

export type Money = z.infer<typeof moneySchema>;

class CurrencyMismatchError extends Error {
  constructor(a: Currency, b: Currency) {
    super(`Cannot combine ${a} and ${b}: currency conversion is not a thing this app does.`);
    this.name = "CurrencyMismatchError";
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export const Money = {
  fromMinor: (amountMinor: number, currency: Currency): Money => ({ amountMinor, currency }),

  /**
   * For display only. The result is a float and must never be stored, summed, or sent back —
   * that round trip is where money loses cents.
   */
  toMajor: (m: Money): number => m.amountMinor / 10 ** CURRENCY_EXPONENT[m.currency],

  format: (m: Money, locale = "fr-TN"): string =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: m.currency,
      minimumFractionDigits: CURRENCY_EXPONENT[m.currency],
      maximumFractionDigits: CURRENCY_EXPONENT[m.currency],
    }).format(Money.toMajor(m)),

  add: (a: Money, b: Money): Money => {
    assertSameCurrency(a, b);
    return { currency: a.currency, amountMinor: a.amountMinor + b.amountMinor };
  },

  subtract: (a: Money, b: Money): Money => {
    assertSameCurrency(a, b);
    return { currency: a.currency, amountMinor: a.amountMinor - b.amountMinor };
  },

  /**
   * Tax in basis points, because a percentage as a float reintroduces exactly the rounding
   * problem integer minor units exist to avoid. 19% is 1900bp.
   *
   * Rounds half-up on the minor unit — a documented choice, not an accident, so an invoice
   * total is reproducible.
   */
  taxOf: (m: Money, rateBp: number): Money => ({
    currency: m.currency,
    amountMinor: Math.round((m.amountMinor * rateBp) / 10_000),
  }),

  isZero: (m: Money): boolean => m.amountMinor === 0,

  equals: (a: Money, b: Money): boolean =>
    a.currency === b.currency && a.amountMinor === b.amountMinor,
} as const;
