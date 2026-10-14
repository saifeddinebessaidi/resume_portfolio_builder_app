import { type User } from "../../users/domain/user.entity";

export const PASSWORD_HASHER = Symbol("PASSWORD_HASHER");
export const CREDENTIALS_REPOSITORY = Symbol("CREDENTIALS_REPOSITORY");

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** Constant-time comparison. False for a malformed stored hash, never a throw. */
  verify(password: string, stored: string): Promise<boolean>;
}

export interface CredentialsRepository {
  /** Case-insensitive on email. `passwordHash` is null for accounts with no password yet. */
  findByEmail(email: string): Promise<{ user: User; passwordHash: string | null } | null>;

  /** Throws `EmailTakenError` when the email is already registered (unique index). */
  create(input: {
    email: string;
    fullName: string | null;
    passwordHash: string;
    externalAuthId: string;
  }): Promise<User>;
}
