import { type UserRole, type UserStatus } from "@repo/contracts";

/**
 * The domain user.
 *
 * Imports nothing from a framework and nothing from Prisma — the enums come from
 * `@repo/contracts`, which is plain TypeScript. That is what lets a use case that depends on this
 * be unit-tested with an object literal and no database.
 */
export interface User {
  id: string;
  externalAuthId: string;
  email: string;
  fullName: string | null;
  locale: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastSeenAt: Date | null;
}

export const isSuspended = (user: User): boolean => user.status === "SUSPENDED";

export const isAdmin = (user: User): boolean => user.role === "ADMIN";
