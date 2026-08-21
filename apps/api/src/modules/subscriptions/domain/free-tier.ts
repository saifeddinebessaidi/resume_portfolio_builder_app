import { type CategoryCode } from "@repo/contracts";

import { type Tx } from "./subscription.repository";

export const PROJECT_COUNTER = Symbol("PROJECT_COUNTER");

/**
 * **How many projects an account may create without paying: one per category.**
 *
 * This closes the hole ADR-0012 knowingly opened. Moving the paywall from creation to delivery meant
 * nothing capped an unpaid account at all, and every project is real rows — a `Project`, a
 * `ProjectVersion` per save, up to 1MB of `Jsonb` each. On Neon's free tier that was a genuine abuse
 * surface, recorded as open question 8 and now answered: **1 free, then the plan's own quota.**
 *
 * One is deliberately enough to finish something. The funnel depends on a visitor building a real CV
 * before being asked for money (ADR-0012), and a limit of zero would restore exactly the dead-end
 * empty dashboard that decision existed to remove. What it stops is the second, third and hundredth.
 *
 * ## Why a constant and not a `PlanEntitlement` row
 *
 * Open question 8 proposed a synthetic "free" plan carrying entitlement rows, so the cap would be data
 * rather than code — consistent with ADR-0005. That is still the better long-term shape and the reason
 * is worth stating: this constant is a **second place** where a limit lives, and someone editing the
 * catalog will not find it.
 *
 * It is a constant today because a free plan is not a subscription: there is no `Subscription` row to
 * hang a `UsageCounter` off, so `ConsumeEntitlementService` — the whole increment-then-verify engine —
 * has nothing to meter against. Making it data properly means either a real zero-price subscription per
 * user at signup, or teaching the resolver to fall back to a planless entitlement set. Both are
 * schema-level decisions, and neither belongs in a UI iteration.
 *
 * Per **category**, not per account: the categories are sold separately, so a free CV should not
 * consume the free portfolio.
 */
export const FREE_TIER_CREATE_LIMIT = 1;

/**
 * Counts a user's live projects in one category.
 *
 * A port for the same reason as `CategoryResolver`, and implemented on the same side: the projects
 * module already depends on subscriptions to consume quota, so importing the projects repository back
 * into the entitlement resolver would make the two mutually dependent and need `forwardRef`.
 *
 * Narrow on purpose — a number, not a repository. A resolver that could read projects would eventually
 * be used to read them.
 */
export interface ProjectCounter {
  /** Excludes soft-deleted rows: a deleted CV must give its free slot back. */
  countLiveFor(userId: string, category: CategoryCode, tx?: Tx): Promise<number>;

  /**
   * Serialises concurrent free-tier creates for one (user, category), for the life of the transaction.
   *
   * **This is required, and counting inside the transaction is not enough** — measured, not assumed:
   * five simultaneous `POST /projects` on a fresh account all returned 201. Under Read Committed each
   * transaction's `count()` sees only rows committed before it started, so all five read zero and all
   * five inserted. Row locking cannot help because there is no shared row to contend on, and the cap
   * ("at most one") is not expressible as a unique index.
   *
   * An advisory lock gives the missing mutual exclusion directly: the first caller takes it, the rest
   * block until that transaction commits, and then their count sees the inserted row. Scoped to the
   * hashed (user, category) key so it never serialises unrelated users, and the `_xact_` variant
   * releases on commit or rollback with no unlock call to forget.
   *
   * Chosen over `runSerializable`, which would also work: serialisable would abort the losers with a
   * write-conflict error that has to be mapped and retried, where this makes them simply wait and then
   * get the honest `ENTITLEMENT_EXHAUSTED`.
   */
  lockForCreate(tx: Tx, userId: string, category: CategoryCode): Promise<void>;
}

/** Shared by the resolver and the create use case, so both compute the same answer. */
export const freeTierHasHeadroom = (liveCount: number): boolean =>
  liveCount < FREE_TIER_CREATE_LIMIT;
