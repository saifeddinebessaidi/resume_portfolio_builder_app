import { Inject, Injectable } from "@nestjs/common";
import {
  EntitlementKey,
  type CategoryCode,
  payloadSchemaFor,
  payloadVersionFor,
} from "@repo/contracts";

import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "../../catalog/domain/catalog.repository";
import { CLOCK, type Clock } from "../../../common/clock/clock";
import { ConsumeEntitlementService } from "../../subscriptions/application/consume-entitlement.service";
import {
  EntitlementExhaustedError,
  NotFoundError,
  ValidationFailedError,
} from "../../../common/errors/errors";
import {
  FREE_TIER_CREATE_LIMIT,
  PROJECT_COUNTER,
  freeTierHasHeadroom,
  type ProjectCounter,
} from "../../subscriptions/domain/free-tier";
import { PROJECT_REPOSITORY, type ProjectRepository } from "../domain/project.repository";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from "../../subscriptions/domain/subscription.repository";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";
import { defaultTitleFor, type Project } from "../domain/project.entity";

export interface CreateProjectCommand {
  actorUserId: string;
  categoryCode: CategoryCode;
  title?: string | undefined;
  data?: Record<string, unknown> | undefined;
}

@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PROJECT_COUNTER) private readonly projectCounter: ProjectCounter,
    private readonly consume: ConsumeEntitlementService,
  ) {}

  async execute(command: CreateProjectCommand): Promise<Project> {
    const now = this.clock.now();

    const category = await this.catalog.findCategoryByCode(command.categoryCode);
    if (!category?.isActive) throw new NotFoundError("Cette catégorie est introuvable.");

    /**
     * **Creating is free. Downloading is what you pay for.**
     *
     * A user with no subscription may build as many projects as they like; the paywall sits at export
     * and publication instead (ADR-0012). So a missing subscription is a normal state here, not an
     * error — the project is simply created unattributed.
     *
     * When a subscription *does* exist, the create quota is still metered against it, so a paying
     * customer's advertised "3 CVs per month" continues to mean exactly that.
     */
    const subscription = await this.subs.findActiveFor(command.actorUserId, category.code, now);

    // Per-category payload validation. Permissive today; phases 4–6 replace one registry entry each
    // and nothing in this file changes — which is the test of whether ADR-0004 was right.
    const parsed = payloadSchemaFor(category.code).safeParse(command.data ?? {});
    if (!parsed.success) {
      throw new ValidationFailedError(
        parsed.error.issues.map((i) => ({
          path: ["data", ...i.path.map(String)].join("."),
          message: i.message,
          code: i.code,
        })),
      );
    }

    /**
     * Quota and mutation in ONE transaction.
     *
     * `consume` increments the counter and throws if that puts it over the limit; the throw rolls
     * back the increment AND the insert together. So a project cannot exist without having been paid
     * for, and an allowance cannot be spent on a project that failed to be created.
     */
    const trimmedTitle = command.title?.trim() ?? "";

    /**
     * Resolved **before** the transaction opens. The catalog read can hit the database on a cold cache,
     * and the pooled connection string allows one connection — querying while the transaction holds it
     * deadlocks (P2024). See the note in ConsumeEntitlementService.
     */
    const quota = subscription
      ? await this.consume.resolve(subscription, EntitlementKey.PROJECT_CREATE_QUOTA)
      : undefined;

    return this.uow.run(async (tx) => {
      if (subscription) {
        // Metered against the plan's own PROJECT_CREATE_QUOTA — "3 CVs per month" stays exactly that.
        await this.consume.consumeResolved(tx, {
          subscription,
          key: EntitlementKey.PROJECT_CREATE_QUOTA,
          definition: quota,
          now,
        });
      } else {
        /**
         * **The free-tier cap** — one project per category without a subscription.
         *
         * Enforced here rather than only in the UI for the obvious reason: `POST /projects` is a public
         * endpoint and a disabled button stops nobody with `curl`. ADR-0012 deliberately left this
         * unbounded and flagged it as the decision's one accepted cost; this is the answer to open
         * question 8.
         *
         * **Locked before counting.** Counting inside the transaction is not sufficient on its own —
         * verified by test: five concurrent creates on a fresh account all returned 201, because under
         * Read Committed every transaction's `count()` saw zero committed rows and every one inserted.
         * The advisory lock supplies the mutual exclusion that no row lock could, since there is no
         * shared row and "at most one" is not expressible as a unique index.
         *
         * `EntitlementExhaustedError` carries the numbers, so the client renders "1 sur 1" without
         * parsing prose.
         */
        await this.projectCounter.lockForCreate(tx, command.actorUserId, category.code);

        const liveCount = await this.projectCounter.countLiveFor(
          command.actorUserId,
          category.code,
          tx,
        );

        if (!freeTierHasHeadroom(liveCount)) {
          throw new EntitlementExhaustedError(
            EntitlementKey.PROJECT_CREATE_QUOTA,
            FREE_TIER_CREATE_LIMIT,
            liveCount,
            null,
            category.code,
          );
        }
      }

      return this.projects.create(tx, {
        userId: command.actorUserId,
        categoryId: category.id,
        subscriptionId: subscription?.id ?? null,
        // An explicit emptiness check, not `??`: a title of "   " trims to "" and must fall through
        // to the default. `??` only catches null/undefined and would store the blank.
        title: trimmedTitle.length > 0 ? trimmedTitle : defaultTitleFor(category.code),
        data: parsed.data,
        schemaVersion: payloadVersionFor(category.code),
      });
    });
  }
}
