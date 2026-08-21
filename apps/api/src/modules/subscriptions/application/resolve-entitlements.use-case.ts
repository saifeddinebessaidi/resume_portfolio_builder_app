import { Inject, Injectable } from "@nestjs/common";
import { type CategoryCode, EntitlementKey } from "@repo/contracts";

import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "../../catalog/domain/catalog.repository";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { PROJECT_COUNTER, freeTierHasHeadroom, type ProjectCounter } from "../domain/free-tier";
import { hasHeadroom, resolveEntitlement, type ResolvedEntitlement } from "../domain/entitlement";
import { hasLapsed, type Subscription } from "../domain/subscription.entity";
import { periodWindowFor } from "../domain/period";
import {
  SUBSCRIPTION_REPOSITORY,
  USAGE_COUNTER_REPOSITORY,
  type SubscriptionRepository,
  type UsageCounterRepository,
} from "../domain/subscription.repository";

export type BlockedReason =
  "NO_ACTIVE_SUBSCRIPTION" | "ENTITLEMENT_EXHAUSTED" | "SUBSCRIPTION_EXPIRED";

export interface CategoryEntitlementState {
  categoryCode: CategoryCode;
  subscription: Subscription | null;
  /**
   * The plan's **display** name — "1 Mois", "6 Mois", "1 An" — resolved from the catalog.
   *
   * Every response used to send `planCodeSnapshot` as the name, so the dashboard badge read
   * "RESUME_1M": a machine key shown to a customer. The code is still the identity and still travels as
   * `planCode`; this is the label.
   *
   * `null` when there is no subscription, or when the plan row has since been deleted — the caller then
   * falls back to the snapshot code, which is the only truthful thing left about a plan that no longer
   * exists.
   */
  planName: string | null;
  entitlements: ResolvedEntitlement[];
  /** Computed here, server-side. The client must never re-derive it from the raw numbers. */
  canCreate: boolean;
  blockedReason: BlockedReason | null;
}

/**
 * Read-only resolution: what does this user currently have for this category?
 *
 * Consumed by `GET /subscriptions/entitlements`, by `GET /dashboard/summary`, and by
 * `EntitlementGuard`. **It is never the authority for a mutation** — it runs outside the mutation's
 * transaction, so between its read and the write a concurrent request can spend the last unit. Its
 * job is a precise error message before any work is done. `ConsumeEntitlementService` is the gate.
 */
@Injectable()
export class ResolveEntitlementsUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(USAGE_COUNTER_REPOSITORY) private readonly counters: UsageCounterRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PROJECT_COUNTER) private readonly projectCounter: ProjectCounter,
  ) {}

  async execute(userId: string, category: CategoryCode): Promise<CategoryEntitlementState> {
    const now = this.clock.now();
    const active = await this.subs.findActiveFor(userId, category, now);

    if (!active) {
      // Distinguishing "never bought" from "it ran out" is worth the extra query: they are two
      // different messages, two different CTAs, and two different conversion signals in phase 8.
      const latest = await this.subs.findLatestFor(userId, category);
      const expired = latest !== null && hasLapsed(latest, now);

      /**
       * **`canCreate` is no longer a flat `false` for an unsubscribed account.**
       *
       * It used to be, and that had been wrong since ADR-0012 made creating free: the dashboard had to
       * work around it with `subscription !== null && !canCreate`, which is the UI second-guessing the
       * server about the server's own rule. Now the free allowance is a real number here, so the
       * client can trust one field again.
       *
       * `blockedReason` stays `ENTITLEMENT_EXHAUSTED` when the free slot is spent rather than gaining a
       * new code: from the user's side it is the same fact — an allowance is used up — and the client
       * distinguishes free from paid by whether `subscription` is null, which it already has.
       */
      const liveCount = await this.projectCounter.countLiveFor(userId, category);
      const freeHeadroom = freeTierHasHeadroom(liveCount);

      return {
        categoryCode: category,
        subscription: null,
        planName: null,
        entitlements: [],
        canCreate: freeHeadroom,
        blockedReason: freeHeadroom
          ? null
          : expired
            ? "SUBSCRIPTION_EXPIRED"
            : "ENTITLEMENT_EXHAUSTED",
      };
    }

    const resolved = await this.resolveFor(active, now);
    const entitlements = resolved.entitlements;

    const createQuota = entitlements.find((e) => e.key === EntitlementKey.PROJECT_CREATE_QUOTA);

    // A plan that does not mention PROJECT_CREATE_QUOTA grants no creations: deny by default, so a
    // missing seed row reads as "not included" rather than "unlimited".
    const canCreate = createQuota ? hasHeadroom(createQuota) : false;

    return {
      categoryCode: category,
      subscription: active,
      planName: resolved.planName,
      entitlements,
      canCreate,
      blockedReason: canCreate ? null : "ENTITLEMENT_EXHAUSTED",
    };
  }

  /** Every category at once, for the dashboard — one pass rather than three round trips per table. */
  async executeAll(
    userId: string,
    categories: CategoryCode[],
  ): Promise<Map<CategoryCode, CategoryEntitlementState>> {
    const states = await Promise.all(categories.map((c) => this.execute(userId, c)));
    return new Map(states.map((s) => [s.categoryCode, s]));
  }

  /**
   * Turns the plan's declared limits into resolved state.
   *
   * Iterates the **plan's** entitlements, not the counter rows: a counter only exists once something
   * has been consumed, so driving off usage would omit every untouched limit and the UI would show
   * nothing until the user had already spent quota.
   */
  private async resolveFor(
    subscription: Subscription,
    now: Date,
  ): Promise<{ entitlements: ResolvedEntitlement[]; planName: string | null }> {
    const plan = await this.catalog.findPlanByCode(subscription.planCodeSnapshot);

    // The snapshot is the source of truth for *what was bought*; if the plan row has since been
    // deleted there is nothing to resolve against, and granting nothing is the safe answer.
    if (!plan) return { entitlements: [], planName: null };

    const usages = await this.counters.findForSubscription(subscription.id);

    const entitlements = plan.entitlements.map((definition) => {
      const window = periodWindowFor(definition.resetPeriod, subscription, now);

      // `NONE`: counted on the resource itself (Project.revisionCount, count(ProjectExport)), so
      // there is no period usage to report here. The projects module fills those in per project.
      if (!window) {
        return resolveEntitlement(definition, null, null);
      }

      const match = usages.find(
        (u) => u.key === definition.key && u.periodStart.getTime() === window.start.getTime(),
      );

      return resolveEntitlement(definition, match?.used ?? 0, window.end);
    });

    return { entitlements, planName: plan.name };
  }
}
