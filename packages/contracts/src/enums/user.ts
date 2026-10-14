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

export const USER_ROLES = Object.values(UserRole);

export const UserStatus = {
  ACTIVE: "ACTIVE",
  /** Blocked at the auth guard, before any module sees the request. */
  SUSPENDED: "SUSPENDED",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const userStatusSchema = z.enum(UserStatus);

export const USER_STATUSES = Object.values(UserStatus);

/**
 * A section or action an admin can switch off for one user, on top of their plan. Absence of an
 * override means "the plan decides"; an override can only take access away, never grant a
 * category the user has not paid for (that is what a subscription grant is for).
 */
export const AccessFeature = {
  RESUME: "RESUME",
  PORTFOLIO: "PORTFOLIO",
  PORTFOLIO_PRO: "PORTFOLIO_PRO",
  AI_GENERATION: "AI_GENERATION",
  EXPORT: "EXPORT",
  PUBLISH: "PUBLISH",
} as const;

export type AccessFeature = (typeof AccessFeature)[keyof typeof AccessFeature];

export const accessFeatureSchema = z.enum(AccessFeature);

export const ACCESS_FEATURES = Object.values(AccessFeature);
