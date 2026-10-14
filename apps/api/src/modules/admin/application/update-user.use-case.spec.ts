import { describe, expect, it, vi } from "vitest";

import { type AdminRepository } from "../domain/admin.repository";
import { type AuditLogPort } from "../../subscriptions/domain/audit-log.port";
import { ForbiddenError, LastAdminError } from "../../../common/errors/errors";
import { type TransactionRunner } from "../../subscriptions/domain/transaction-runner.port";
import { type ProvisionUserUseCase } from "../../users/application/provision-user.use-case";
import { UpdateUserUseCase } from "./update-user.use-case";
import { type User } from "../../users/domain/user.entity";
import { type UserRepository } from "../../users/domain/user.repository";

const user = (overrides: Partial<User> = {}): User => ({
  id: "target",
  externalAuthId: "ext",
  email: "t@example.com",
  fullName: null,
  locale: "fr",
  role: "USER",
  status: "ACTIVE",
  createdAt: new Date("2026-01-01"),
  lastSeenAt: null,
  ...overrides,
});

function setup(target: User, activeAdmins: number) {
  const lockAdminRoster = vi.fn(() => Promise.resolve());
  const updateUser = vi.fn((_tx: unknown, _id: string, patch: Partial<User>) =>
    Promise.resolve({ ...target, ...patch }),
  );
  const record = vi.fn(() => Promise.resolve());
  const admin = {
    lockAdminRoster,
    countActiveAdmins: () => Promise.resolve(activeAdmins),
    updateUser,
  } as unknown as AdminRepository;
  const users = { findById: () => Promise.resolve(target) } as unknown as UserRepository;
  const audit: AuditLogPort = { record };
  const uow = { run: (fn: (tx: unknown) => Promise<unknown>) => fn({}) } as TransactionRunner;

  return {
    useCase: new UpdateUserUseCase(users, admin, audit, uow, {
      invalidate: () => undefined,
    } as unknown as ProvisionUserUseCase),
    lockAdminRoster,
    updateUser,
    record,
  };
}

describe("UpdateUserUseCase", () => {
  it("refuses to let an admin change their own role or status", async () => {
    const { useCase } = setup(user({ id: "me", role: "ADMIN" }), 3);
    await expect(
      useCase.execute({ actorUserId: "me", targetUserId: "me", role: "USER", reason: "x" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuses to demote the last active admin", async () => {
    const { useCase, updateUser } = setup(user({ role: "ADMIN" }), 1);
    await expect(
      useCase.execute({ actorUserId: "me", targetUserId: "target", role: "USER", reason: "x" }),
    ).rejects.toBeInstanceOf(LastAdminError);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses to suspend the last active admin", async () => {
    const { useCase } = setup(user({ role: "ADMIN" }), 1);
    await expect(
      useCase.execute({
        actorUserId: "me",
        targetUserId: "target",
        status: "SUSPENDED",
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(LastAdminError);
  });

  it("demotes an admin when another one remains, under the roster lock, and audits it", async () => {
    const { useCase, lockAdminRoster, record } = setup(user({ role: "ADMIN" }), 2);
    const updated = await useCase.execute({
      actorUserId: "me",
      targetUserId: "target",
      role: "USER",
      reason: "left the team",
    });
    expect(updated.role).toBe("USER");
    expect(lockAdminRoster).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "user.updated", entityId: "target" }),
    );
  });

  it("suspends a regular user without touching the admin roster", async () => {
    const { useCase, lockAdminRoster } = setup(user(), 1);
    await useCase.execute({
      actorUserId: "me",
      targetUserId: "target",
      status: "SUSPENDED",
      reason: "abuse",
    });
    expect(lockAdminRoster).not.toHaveBeenCalled();
  });
});
