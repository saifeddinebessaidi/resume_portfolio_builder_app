import { describe, expect, it, vi } from "vitest";

import {
  AccountSuspendedError,
  EmailTakenError,
  InvalidCredentialsError,
} from "../../../common/errors/errors";
import { type CredentialsRepository, type PasswordHasher } from "../domain/credentials";
import { PasswordAuthUseCase } from "./password-auth.use-case";
import { type User } from "../../users/domain/user.entity";

const user = (overrides: Partial<User> = {}): User => ({
  id: "u1",
  externalAuthId: "pwd_1",
  email: "a@example.com",
  fullName: null,
  locale: "fr",
  role: "USER",
  status: "ACTIVE",
  createdAt: new Date(),
  lastSeenAt: null,
  ...overrides,
});

// "hash" is just a prefix, so the tests read clearly; the real hasher has its own spec.
const hasher: PasswordHasher = {
  hash: (p) => Promise.resolve(`h:${p}`),
  verify: (p, stored) => Promise.resolve(stored === `h:${p}`),
};

function setup(found: { user: User; passwordHash: string | null } | null) {
  const create = vi.fn((input: { email: string; externalAuthId: string }) =>
    Promise.resolve(user({ email: input.email, externalAuthId: input.externalAuthId })),
  );
  const repo: CredentialsRepository = { findByEmail: () => Promise.resolve(found), create };
  return { useCase: new PasswordAuthUseCase(repo, hasher), create };
}

describe("PasswordAuthUseCase", () => {
  it("signs up with a hashed password and a fresh identity, never a role from input", async () => {
    const { useCase, create } = setup(null);
    const created = await useCase.signUp({ email: "a@example.com", password: "longenough1" });
    expect(created.role).toBe("USER");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: "h:longenough1" }));
    expect(create.mock.calls[0]?.[0].externalAuthId).toMatch(/^pwd_/);
  });

  it("refuses to sign up an email that already exists", async () => {
    const { useCase } = setup({ user: user(), passwordHash: null });
    await expect(
      useCase.signUp({ email: "a@example.com", password: "longenough1" }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("signs in with the right password", async () => {
    const { useCase } = setup({ user: user(), passwordHash: "h:secret-pass" });
    await expect(
      useCase.signIn({ email: "a@example.com", password: "secret-pass" }),
    ).resolves.toMatchObject({ id: "u1" });
  });

  it("gives the same error for a wrong password, an unknown email and a password-less account", async () => {
    for (const found of [
      { user: user(), passwordHash: "h:secret-pass" },
      null,
      { user: user(), passwordHash: null },
    ]) {
      const { useCase } = setup(found);
      await expect(
        useCase.signIn({ email: "a@example.com", password: "wrong" }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
  });

  it("refuses a suspended account only after the password matches", async () => {
    const { useCase } = setup({ user: user({ status: "SUSPENDED" }), passwordHash: "h:pw" });
    await expect(useCase.signIn({ email: "a@example.com", password: "pw" })).rejects.toBeInstanceOf(
      AccountSuspendedError,
    );
    await expect(
      useCase.signIn({ email: "a@example.com", password: "nope" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
