import { Inject, Injectable } from "@nestjs/common";

import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "../../catalog/domain/catalog.repository";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from "../domain/subscription.repository";
import { type Subscription } from "../domain/subscription.entity";

/** A subscription paired with the plan's display name, so the account screen never shows a machine key. */
export interface SubscriptionWithPlanName {
  subscription: Subscription;
  /**
   * "1 Mois" / "6 Mois" / "1 An" — the catalog's own label.
   *
   * Falls back to `planCodeSnapshot` when the plan row has been deleted. The earlier code used the
   * snapshot *always*, reasoning that joining to the live plan would inherit a renamed label onto a
   * historical record. That trade-off was decided the wrong way round: what must never change on a
   * historical record is the **price**, and that is snapshotted on the subscription itself. A renamed
   * plan showing its new name is acceptable; showing a customer "RESUME_6M" is not.
   */
  planName: string;
}

@Injectable()
export class ListMySubscriptionsUseCase {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
  ) {}

  /** All statuses, newest first: the account screen shows history, not only the live term. */
  async execute(userId: string): Promise<SubscriptionWithPlanName[]> {
    const subscriptions = await this.subs.findAllFor(userId);

    /**
     * Resolved once per distinct plan code, not once per subscription: an account with a year of
     * monthly renewals holds twelve rows on the same plan, and the catalog read — though cached — should
     * not be repeated twelve times.
     */
    const names = new Map<string, string>();

    for (const code of new Set(subscriptions.map((s) => s.planCodeSnapshot))) {
      const plan = await this.catalog.findPlanByCode(code);
      if (plan) names.set(code, plan.name);
    }

    return subscriptions.map((subscription) => ({
      subscription,
      planName: names.get(subscription.planCodeSnapshot) ?? subscription.planCodeSnapshot,
    }));
  }
}
