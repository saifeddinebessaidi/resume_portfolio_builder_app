import { Inject, Injectable } from "@nestjs/common";
import { type UserRole, type UserStatus } from "@repo/contracts";

import { ADMIN_REPOSITORY, type AdminRepository } from "../domain/admin.repository";
import { AUDIT_LOG, type AuditLogPort } from "../../subscriptions/domain/audit-log.port";
import { ForbiddenError, LastAdminError, NotFoundError } from "../../../common/errors/errors";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";
import { ProvisionUserUseCase } from "../../users/application/provision-user.use-case";
import { type User } from "../../users/domain/user.entity";
import { USER_REPOSITORY, type UserRepository } from "../../users/domain/user.repository";

export interface UpdateUserCommand {
  actorUserId: string;
  targetUserId: string;
  role?: UserRole | undefined;
  status?: UserStatus | undefined;
  reason: string;
  ip?: string | undefined;
}

/**
 * Promote, demote, suspend, reactivate.
 *
 * Two rules on top of the audit trail: an admin cannot change their own role or status (a typo
 * would lock them out with nobody to undo it), and the last active admin can never be demoted or
 * suspended. The AuthGuard's 60-second user cache is evicted after the commit, so a suspension or
 * demotion applies on the target's next request (on this instance; others catch up within the TTL).
 */
@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ADMIN_REPOSITORY) private readonly admin: AdminRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
    private readonly provisioning: ProvisionUserUseCase,
  ) {}

  async execute(command: UpdateUserCommand): Promise<User> {
    if (command.actorUserId === command.targetUserId) {
      throw new ForbiddenError("Vous ne pouvez pas modifier votre propre rôle ou statut.");
    }

    const target = await this.users.findById(command.targetUserId);
    if (!target) throw new NotFoundError("Cet utilisateur est introuvable.");

    const losesAdmin =
      target.role === "ADMIN" &&
      target.status === "ACTIVE" &&
      (command.role === "USER" || command.status === "SUSPENDED");

    const updated = await this.uow.run(async (tx) => {
      if (losesAdmin) {
        await this.admin.lockAdminRoster(tx);
        if ((await this.admin.countActiveAdmins(tx)) <= 1) throw new LastAdminError();
      }

      const updated = await this.admin.updateUser(tx, target.id, {
        ...(command.role ? { role: command.role } : {}),
        ...(command.status ? { status: command.status } : {}),
      });

      await this.audit.record(tx, {
        actorUserId: command.actorUserId,
        action: "user.updated",
        entityType: "User",
        entityId: target.id,
        before: { role: target.role, status: target.status },
        after: { role: updated.role, status: updated.status, reason: command.reason },
        ip: command.ip ?? null,
      });

      return updated;
    });

    this.provisioning.invalidate(target.externalAuthId);
    return updated;
  }
}
