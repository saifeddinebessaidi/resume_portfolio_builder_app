import { type Tx } from "./subscription.repository";

export const TRANSACTION_RUNNER = Symbol("TRANSACTION_RUNNER");

/**
 * "Do these writes together, or not at all."
 *
 * A port rather than a direct `UnitOfWork` import, because `application/` may not depend on
 * `infrastructure/` — and a use case genuinely does not need to know that the transaction is a
 * Prisma interactive transaction. It needs only the guarantee.
 *
 * The guarantee is what the entitlement engine is built on: quota consumption and the mutation it
 * authorizes must commit or roll back as one, or a rejected create can still have spent the user's
 * allowance.
 */
export interface TransactionRunner {
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}
