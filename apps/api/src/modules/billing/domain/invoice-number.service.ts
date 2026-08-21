import { type Tx } from "../../subscriptions/domain/subscription.repository";

export const INVOICE_NUMBER_SERVICE = Symbol("INVOICE_NUMBER_SERVICE");

/**
 * Issues the next invoice number for a year.
 *
 * A port because the guarantee — "never returns the same value twice, including under concurrent
 * transactions" — is what the caller depends on, and it is a database capability rather than
 * application logic. `count(*) + 1` is the obvious implementation and is wrong: two simultaneous
 * transactions read the same count and the unique constraint then fails one of them at random.
 *
 * Takes the transaction handle because the number must be assigned in the same transaction as the
 * transition to PAID. Issued outside it, a rolled-back payment would still have consumed a number
 * that nothing references.
 */
export interface InvoiceNumberService {
  /** Returns a formatted number, e.g. `REACCHY-2026-00001`. */
  next(tx: Tx, year: number): Promise<string>;
}
