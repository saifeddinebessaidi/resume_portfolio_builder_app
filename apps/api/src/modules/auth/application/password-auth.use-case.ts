import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { type SignInRequest, type SignUpRequest } from "@repo/contracts";

import {
  AccountSuspendedError,
  EmailTakenError,
  InvalidCredentialsError,
} from "../../../common/errors/errors";
import {
  CREDENTIALS_REPOSITORY,
  type CredentialsRepository,
  PASSWORD_HASHER,
  type PasswordHasher,
} from "../domain/credentials";
import { type User } from "../../users/domain/user.entity";

/**
 * A hash of a random string, verified against when the email is unknown, so "no such account" and
 * "wrong password" take the same time. Without it, response latency alone enumerates accounts.
 */
let dummyHash: Promise<string> | null = null;

@Injectable()
export class PasswordAuthUseCase {
  constructor(
    @Inject(CREDENTIALS_REPOSITORY) private readonly credentials: CredentialsRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async signUp(input: SignUpRequest): Promise<User> {
    // Checked up front for a friendly error; the unique index is still the real guarantee.
    if (await this.credentials.findByEmail(input.email)) throw new EmailTakenError();

    return this.credentials.create({
      email: input.email,
      fullName: input.fullName ?? null,
      passwordHash: await this.hasher.hash(input.password),
      // Our own identity anchor; becomes the token's `sub`.
      externalAuthId: `pwd_${randomUUID()}`,
    });
  }

  async signIn(input: SignInRequest): Promise<User> {
    const found = await this.credentials.findByEmail(input.email);

    if (!found?.passwordHash) {
      dummyHash ??= this.hasher.hash(randomUUID());
      await this.hasher.verify(input.password, await dummyHash);
      throw new InvalidCredentialsError();
    }

    if (!(await this.hasher.verify(input.password, found.passwordHash))) {
      throw new InvalidCredentialsError();
    }

    // Checked after the password, so a suspended account is not revealed to someone without it.
    if (found.user.status === "SUSPENDED") throw new AccountSuspendedError();

    return found.user;
  }
}
