import { createHash } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";

import { AppConfigService } from "../../../config/app-config.service";
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "../../catalog/domain/catalog.repository";
import { IDEMPOTENCY_STORE, type IdempotencyStore } from "../domain/idempotency.port";
import {
  IdempotencyConflictError,
  InternalError,
  NotFoundError,
  PlanInactiveError,
} from "../../../common/errors/errors";
import { ORDER_REPOSITORY, type OrderRepository } from "../domain/order.repository";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";
import { type Order } from "../domain/order.entity";
import { type Plan } from "../../catalog/domain/catalog.entity";

export interface CreateOrderCommand {
  userId: string;
  planCode: string;
  /** From the `Idempotency-Key` header. Absent is allowed — deduplication is then the client's. */
  idempotencyKey?: string | undefined;
}

/** Stable across key orderings, so a retry that serialises its JSON differently still replays. */
const hashRequest = (userId: string, planCode: string): string =>
  createHash("sha256").update(JSON.stringify({ userId, planCode })).digest("hex");

/**
 * A unique violation, however it reaches us.
 *
 * `P2002` is Prisma's code; `23505` is Postgres' own, which surfaces when the failure comes from a
 * raw query rather than the query builder. Matched structurally rather than with `instanceof
 * Prisma.PrismaClientKnownRequestError` because `application/` may not import `@prisma/client` —
 * knowing that a duplicate key is an error code belongs here, knowing Prisma's class does not.
 */
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null || !("code" in e)) return false;

  const { code } = e;
  return code === "P2002" || code === "23505";
}

/**
 * Turns "I want this plan" into a `PENDING` order with the price frozen.
 *
 * Nothing about payment happens here. That separation is the point of ADR-0007: a bank transfer
 * order sits `PENDING` for days, and the intent has to exist and be quotable in the meantime.
 */
@Injectable()
export class CreateOrderUseCase {
  private readonly logger = new Logger(CreateOrderUseCase.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
    private readonly config: AppConfigService,
  ) {}

  async execute(command: CreateOrderCommand): Promise<Order> {
    const key = command.idempotencyKey;

    if (!key)
      return this.createOrder(command.userId, await this.requirePlan(command.planCode), null);

    const hash = hashRequest(command.userId, command.planCode);

    /**
     * The replay check comes **before** the plan is validated, deliberately.
     *
     * A retry is a question about a request that already succeeded, not a new purchase, and it has
     * to answer identically however the catalog has moved since. With the order reversed, retrying
     * a request whose plan was retired in the meantime returns `PLAN_INACTIVE` for an order that
     * exists and was paid for — which is precisely the outcome an idempotency key is there to
     * prevent. It also means a reused key is reported as `IDEMPOTENCY_CONFLICT` rather than as
     * whatever happens to be wrong with the second body.
     */
    const existing = await this.idempotency.find(command.userId, key);
    if (existing) return this.replay(existing, hash, key, command.userId);

    const plan = await this.requirePlan(command.planCode);

    try {
      return await this.createOrder(command.userId, plan, { key, hash });
    } catch (error) {
      // Two requests raced past the `find` above. The loser blocked on the primary key until the
      // winner committed, so by the time we are here the original order exists and is readable.
      if (!isUniqueViolation(error)) throw error;

      const winner = await this.idempotency.find(command.userId, key);
      if (!winner) throw error;

      this.logger.log(`Idempotency-Key ${key} raced; replaying the winning order.`);
      return this.replay(winner, hash, key, command.userId);
    }
  }

  private async requirePlan(planCode: string): Promise<Plan> {
    const plan = await this.catalog.findPlanByCode(planCode);
    if (!plan) throw new NotFoundError("Cette offre est introuvable.");

    // Found-but-retired is a different answer from not-found. `findPlanByCode` deliberately does
    // not filter on isActive, so a customer with a stale pricing page gets "no longer available"
    // rather than a 404 that reads like a typo.
    if (!plan.isActive) throw new PlanInactiveError(plan.code);

    return plan;
  }

  private async replay(
    record: { requestHash: string; resourceId: string | null },
    hash: string,
    key: string,
    userId: string,
  ): Promise<Order> {
    // Same key, different body. That is a client bug rather than a retry, and returning the
    // original order would silently sell the customer a plan they did not just ask for.
    if (record.requestHash !== hash) throw new IdempotencyConflictError(key);

    const order = record.resourceId
      ? await this.orders.findByIdForUser(record.resourceId, userId)
      : null;

    if (!order) {
      // The key row exists but its order does not. Only reachable if a resourceId was never
      // attached, which the creating transaction makes impossible — so this is a defect, not a
      // condition the caller can act on.
      throw new InternalError(`Idempotency key ${key} has no resolvable order.`);
    }

    return order;
  }

  private createOrder(
    userId: string,
    plan: Plan,
    idempotency: { key: string; hash: string } | null,
  ): Promise<Order> {
    return this.uow.run(async (tx) => {
      // Claimed BEFORE the order is written: the insert is what serialises concurrent callers, and
      // doing it first means the loser blocks before spending work on an order it will discard.
      if (idempotency) {
        await this.idempotency.claim(tx, {
          userId,
          key: idempotency.key,
          requestHash: idempotency.hash,
        });
      }

      const order = await this.orders.create(tx, {
        userId,
        planId: plan.id,
        categoryId: plan.categoryId,
        // The four snapshots. Written now so a later price or VAT edit cannot rewrite what this
        // customer was shown, nor the invoice generated from it (ADR-0006).
        amountMinor: plan.priceMinor,
        currency: plan.currency,
        taxRateBp: this.config.billingTaxRateBp,
        planCodeSnapshot: plan.code,
        idempotencyKey: idempotency?.key ?? null,
      });

      if (idempotency) {
        await this.idempotency.attach(tx, {
          userId,
          key: idempotency.key,
          resourceId: order.id,
        });
      }

      this.logger.log(
        `Order ${order.id} created for user ${userId}: ${plan.code} at ${plan.priceMinor} ${plan.currency}`,
      );

      return order;
    });
  }
}
