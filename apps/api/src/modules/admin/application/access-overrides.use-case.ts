import { Inject, Injectable } from "@nestjs/common";
import { type AccessFeature, type CategoryCode, type EntitlementKey } from "@repo/contracts";

import { ADMIN_REPOSITORY, type AdminRepository } from "../domain/admin.repository";
import { AUDIT_LOG, type AuditLogPort } from "../../subscriptions/domain/audit-log.port";
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from "../../catalog/domain/catalog.repository";
import { NotFoundError } from "../../../common/errors/errors";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";
import { USER_REPOSITORY, type UserRepository } from "../../users/domain/user.repository";

interface Actor {
  actorUserId: string;
  reason: string;
  ip?: string | undefined;
}

/**
 * Per-user exceptions on top of the plan: section switches and quota overrides.
 *
 * Both are read by the entitlement engine on every check (no cache), so a change applies to the
 * user's next request. Every write — including a reset — writes an AuditLog row with before/after.
 */
@Injectable()
export class AccessOverridesUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
  ) {}

  private async requireUser(id: string): Promise<void> {
    if (!(await this.users.findById(id)))
      throw new NotFoundError("Cet utilisateur est introuvable.");
  }

  private async requireCategoryId(code: CategoryCode): Promise<string> {
    const category = await this.catalog.findCategoryByCode(code);
    if (!category) throw new NotFoundError("Cette catégorie est introuvable.");
    return category.id;
  }

  async setFeature(
    command: Actor & { userId: string; feature: AccessFeature; enabled: boolean },
  ): Promise<void> {
    await this.requireUser(command.userId);

    await this.uow.run(async (tx) => {
      const before = await this.admin.findAccessOverride(tx, command.userId, command.feature);

      // Enabling a feature that has no override is "back to the plan": store nothing rather than a
      // row that means the same as its absence.
      if (command.enabled) {
        await this.admin.deleteAccessOverride(tx, command.userId, command.feature);
      } else {
        await this.admin.upsertAccessOverride(tx, {
          userId: command.userId,
          feature: command.feature,
          enabled: false,
          reason: command.reason,
          actorId: command.actorUserId,
        });
      }

      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: command.enabled ? "user.feature.enabled" : "user.feature.disabled",
        entityType: "User",
        entityId: command.userId,
        before: before ? { feature: command.feature, ...before } : null,
        after: { feature: command.feature, enabled: command.enabled, reason: command.reason },
        ip: command.ip ?? null,
      });
    });
  }

  async setLimit(
    command: Actor & {
      userId: string;
      categoryCode: CategoryCode;
      key: EntitlementKey;
      limitValue: number | null;
    },
  ): Promise<void> {
    await this.requireUser(command.userId);
    const categoryId = await this.requireCategoryId(command.categoryCode);

    await this.uow.run(async (tx) => {
      const before = await this.admin.findEntitlementOverride(
        tx,
        command.userId,
        categoryId,
        command.key,
      );

      await this.admin.upsertEntitlementOverride(tx, {
        userId: command.userId,
        categoryId,
        key: command.key,
        limitValue: command.limitValue,
        reason: command.reason,
        actorId: command.actorUserId,
      });

      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: "user.limit.overridden",
        entityType: "User",
        entityId: command.userId,
        before: before ? { categoryCode: command.categoryCode, key: command.key, ...before } : null,
        after: {
          categoryCode: command.categoryCode,
          key: command.key,
          limitValue: command.limitValue,
          reason: command.reason,
        },
        ip: command.ip ?? null,
      });
    });
  }

  async clearLimit(
    command: Actor & { userId: string; categoryCode: CategoryCode; key: EntitlementKey },
  ): Promise<void> {
    const categoryId = await this.requireCategoryId(command.categoryCode);

    await this.uow.run(async (tx) => {
      const before = await this.admin.findEntitlementOverride(
        tx,
        command.userId,
        categoryId,
        command.key,
      );
      if (!before) return;

      await this.admin.deleteEntitlementOverride(tx, command.userId, categoryId, command.key);

      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: "user.limit.reset",
        entityType: "User",
        entityId: command.userId,
        before: { categoryCode: command.categoryCode, key: command.key, ...before },
        after: { reason: command.reason },
        ip: command.ip ?? null,
      });
    });
  }
}
