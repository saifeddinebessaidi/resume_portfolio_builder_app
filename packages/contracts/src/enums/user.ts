import { z } from "zod";

/**
 * Roles are granted by an admin action that writes an AuditLog row — **never** read from a
 * token claim. Token metadata is user-influenceable; a column in our database is not. The
 * reference project's signup trigger had to explicitly defend against a user self-assigning
 * `role: "admin"` in their signup metadata, which is exactly the bug this avoids.
 */
export const UserRole = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const userRoleSchema = z.enum(UserRole);

export const UserStatus = {
  ACTIVE: "ACTIVE",
  /** Blocked at the auth guard, before any module sees the request. */
  SUSPENDED: "SUSPENDED",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const userStatusSchema = z.enum(UserStatus);
