import { type Tx } from "../../subscriptions/domain/subscription.repository";

export const IDEMPOTENCY_STORE = Symbol("IDEMPOTENCY_STORE");

export interface IdempotencyRecord {
  key: string;
  userId: string;
  requestHash: string;
  /** The created resource's id. `null` only while the creating transaction is still open. */
  resourceId: string | null;
}

/**
 * The store behind the `Idempotency-Key` header.
 *
 * Two distinct jobs, which is why this is a port rather than a `findOrCreate` helper:
 *
 * 1. **Replay** — the same key with the same body must return the original resource.
 * 2. **Reject** — the same key with a *different* body is a client bug, not a retry, and must
 *    surface as `409` rather than quietly returning someone else's order.
 *
 * `claim` is the concurrency control. It inserts inside the caller's transaction, so two
 * simultaneous requests carrying one key serialise on the primary key: the loser blocks until the
 * winner commits, then fails the insert and replays. That is what makes "exactly one order" a
 * database guarantee rather than a hopeful read-then-write.
 */
export interface IdempotencyStore {
  find(userId: string, key: string): Promise<IdempotencyRecord | null>;

  /**
   * Inserts the key. Throws the underlying unique violation on a duplicate — the caller catches
   * it and replays, because at that point the winning transaction has committed.
   */
  claim(tx: Tx, record: { userId: string; key: string; requestHash: string }): Promise<void>;

  /** Called inside the same transaction, once the resource exists. */
  attach(tx: Tx, args: { userId: string; key: string; resourceId: string }): Promise<void>;

  /** Retention sweep. Returns how many rows were removed. */
  pruneOlderThan(cutoff: Date): Promise<number>;
}
