import { Inject, Injectable } from "@nestjs/common";
import { type EntitlementKey } from "@repo/contracts";

import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "../../catalog/domain/catalog.repository";
import { EntitlementExhaustedError } from "../../../common/errors/errors";
import { entitlementFor, type PlanEntitlement } from "../../catalog/domain/catalog.entity";
import { periodWindowFor } from "../domain/period";
import { type Subscription } from "../domain/subscription.entity";
import {
  USAGE_COUNTER_REPOSITORY,
  type Tx,
  type UsageCounterRepository,
} from "../domain/subscription.repository";

/**
 * **The critical code in the application.** Quota is spent here and nowhere else.
 *
 * The contract on every caller: pass the transaction that also performs the mutation being
 * authorized. `increment → verify → act`, all three inside one transaction, is what makes the check
 * real:
 *
 * Consider `RESUME_1M` (limit 3) with 2 used, and two simultaneous create requests.
 *
 * | | Naïve `count()` then `create()` | This implementation |
 * | --- | --- | --- |
 * | A | reads 2, 2 < 3 → creates | upsert → used = 3, 3 ≤ 3 → creates |
 * | B | reads 2, 2 < 3 → creates | upsert **blocks on A's row lock**, then used = 4, 4 > 3 → throws, rolls back |
 * | result | **4 projects on a 3-project plan** | 3 projects, B gets 403 |
 *
 * The naïve version is invisible in manual testing and appears on a double-click or a retried
 * request. Phase 9 step 03 fires concurrent requests at this specifically.
 */
@Injectable()
export class ConsumeEntitlementService {
  constructor(
    @Inject(USAGE_COUNTER_REPOSITORY) private readonly counters: UsageCounterRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
  ) {}

  /**
   * Spends one unit of `key`, or throws.
   *
   * Returns how many units remain after the spend (`null` for unlimited), so a caller can put the
   * number straight into an analytics event without a second read.
   */
  async consume(
    tx: Tx,
    args: { subscription: Subscription; key: EntitlementKey; now: Date },
  ): Promise<{ remaining: number | null }> {
    /**
     * **The plan is resolved BEFORE any transactional work.**
     *
     * This lookup can hit the database (the catalog cache is cold after a restart), and the pooled
     * connection string runs `connection_limit=1`. Reading on the base client while `tx` holds that one
     * connection is a self-deadlock: the read waits for a connection the transaction will not release
     * until the read completes. It surfaced as `P2024` on the first create after a cold start and was
     * invisible whenever the cache happened to be warm.
     *
     * Hence `resolve()` below, which every caller invokes *outside* `uow.run` and passes in. This
     * overload stays for the non-transactional case and does its own resolution first, before touching
     * the counter.
     */
    const definition = await this.resolve(args.subscription, args.key);
    return this.applyDefinition(tx, { ...args, definition });
  }

  private async applyDefinition(
    tx: Tx,
    args: {
      subscription: Subscription;
      key: EntitlementKey;
      definition: PlanEntitlement | undefined;
      now: Date;
    },
  ): Promise<{ remaining: number | null }> {
    const { definition } = args;

    /**
     * **Deny by default.** A plan that does not declare a key grants zero of it — a forgotten seed
     * row must read as "not included in this offer", never as "unlimited". This is the single most
     * important line for not silently giving away paid features.
     */
    if (!definition) {
      throw new EntitlementExhaustedError(args.key, 0, 0, null, args.subscription.categoryCode);
    }

    // null = unlimited: nothing to meter, nothing to write.
    if (definition.limitValue === null) return { remaining: null };

    // 0 = explicitly denied. Distinct from a missing row, and worth failing before touching a
    // counter that would never be readable as anything but over-limit.
    if (definition.limitValue === 0) {
      throw new EntitlementExhaustedError(args.key, 0, 0, null, args.subscription.categoryCode);
    }

    const window = periodWindowFor(definition.resetPeriod, args.subscription, args.now);

    // `NONE`: this limit is counted on the resource itself (Project.revisionCount,
    // count(ProjectExport)). The calling use case checks its own counter — see
    // UpdateProjectUseCase and ExportProjectUseCase, which throw the per-resource errors.
    if (!window) return { remaining: null };

    // 1. INCREMENT FIRST. The composite unique constraint makes concurrent callers serialise on the
    //    row lock, so the value read below already includes any competing increment.
    const used = await this.counters.incrementAndRead(tx, {
      subscriptionId: args.subscription.id,
      key: args.key,
      periodStart: window.start,
      periodEnd: window.end,
    });

    // 2. VERIFY AFTER. Over the limit → throw → the whole transaction rolls back, including this
    //    increment and the caller's mutation. The user is not charged for a project they did not get.
    if (used > definition.limitValue) {
      throw new EntitlementExhaustedError(
        args.key,
        definition.limitValue,
        // Report the pre-increment figure: `used` includes this failed attempt, and telling a user
        // they have used 4 of 3 is confusing.
        definition.limitValue,
        window.end,
        args.subscription.categoryCode,
      );
    }

    return { remaining: definition.limitValue - used };
  }

  /**
   * Resolves a plan's declaration for one key.
   *
   * **Call this outside a transaction**, then hand the result to `consumeResolved`. It may query the
   * catalog, and doing that while a transaction holds the single pooled connection deadlocks — see the
   * note in `consume`.
   *
   * Returns `undefined` when the plan does not declare the key (deny by default) or when the plan row
   * has vanished.
   */
  async resolve(
    subscription: Subscription,
    key: EntitlementKey,
  ): Promise<PlanEntitlement | undefined> {
    const plan = await this.catalog.findPlanByCode(subscription.planCodeSnapshot);
    if (!plan) return undefined;

    return entitlementFor(plan, key);
  }

  /**
   * The limit for a per-resource key, for callers that count on the resource themselves.
   *
   * `undefined` when the plan does not declare the key — deny by default. `null` means unlimited.
   */
  async limitFor(
    subscription: Subscription,
    key: EntitlementKey,
  ): Promise<{ limit: number | null } | undefined> {
    const definition = await this.resolve(subscription, key);
    return definition ? { limit: definition.limitValue } : undefined;
  }

  /**
   * The transactional half: increment, verify, and nothing else.
   *
   * Takes an already-resolved definition so **no catalog I/O happens inside the transaction**. This is
   * the method every use case should call from within `uow.run`.
   */
  async consumeResolved(
    tx: Tx,
    args: {
      subscription: Subscription;
      key: EntitlementKey;
      definition: PlanEntitlement | undefined;
      now: Date;
    },
  ): Promise<{ remaining: number | null }> {
    return this.applyDefinition(tx, args);
  }
}
