import { type User } from "./user.entity";

/** Injection token. `presentation/users.module.ts` binds it to the Prisma implementation. */
export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface ProvisionUserInput {
  externalAuthId: string;
  email: string;
}

/**
 * The three states are all meaningful under `exactOptionalPropertyTypes`, which is why `undefined`
 * is spelled out rather than implied: absent means "leave it alone", `null` means "clear it", and a
 * value means "set it". That is exactly PATCH semantics, and collapsing absent into `null` would
 * wipe a field the client never mentioned.
 */
export interface UpdateProfileInput {
  fullName?: string | null | undefined;
  locale?: string | undefined;
}

/**
 * The persistence contract for users, stated as an interface so use cases depend on this and not
 * on Prisma. `InMemoryUserRepository` (tests) and `PrismaUserRepository` (production) are
 * interchangeable behind it, including their error behaviour.
 */
export interface UserRepository {
  /**
   * Creates the local mirror of an external identity, or refreshes it.
   *
   * **`role` and `status` are never part of the update.** A returning user's privileges cannot be
   * reset by anything in their token, and creation hardcodes `USER` — so there is no code path by
   * which a token claim becomes a role.
   */
  provision(input: ProvisionUserInput): Promise<User>;

  findById(id: string): Promise<User | null>;

  findByExternalAuthId(externalAuthId: string): Promise<User | null>;

  updateProfile(id: string, input: UpdateProfileInput): Promise<User>;

  /**
   * Separate from `provision` because it is rate-limited to roughly hourly: on Neon's free tier
   * a write on every authenticated request is worth avoiding, and nothing depends on
   * `lastSeenAt` being precise to the second.
   */
  touchLastSeen(id: string, at: Date): Promise<void>;
}
