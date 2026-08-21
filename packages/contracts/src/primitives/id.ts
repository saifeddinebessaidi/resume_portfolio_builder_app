import { z } from "zod";

/**
 * A cuid-shaped identifier.
 *
 * Deliberately a shape check rather than `z.cuid()`: Prisma's `cuid()` and `cuid2()` differ in
 * length and alphabet, and a strict validator would reject ids the database happily produced.
 * The purpose here is to reject obvious junk (empty strings, a whole JSON blob, an email) in
 * a path parameter before it reaches a query — not to re-implement cuid.
 */
export const idSchema = z
  .string()
  .trim()
  .min(8, "identifier is too short")
  .max(64, "identifier is too long")
  .regex(/^[a-z0-9_-]+$/i, "identifier contains unexpected characters");

export type Id = z.infer<typeof idSchema>;

/**
 * The public URL segment of a publication: `/p/:slug`.
 *
 * Lowercase, hyphen-separated, no leading/trailing hyphen. The 3-character minimum keeps the
 * namespace from filling with single letters, and the reserved list stops a user claiming a
 * slug that collides with an app route.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "slug must be at least 3 characters")
  .max(60, "slug must be at most 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "slug may contain lowercase letters, digits and single hyphens only",
  );

export type Slug = z.infer<typeof slugSchema>;

/**
 * Slugs the app itself needs. Checked at publish time; a user asking for one of these gets a
 * validation error rather than a link that shadows a real route.
 */
export const RESERVED_SLUGS = [
  "api",
  "app",
  "admin",
  "account",
  "auth",
  "login",
  "logout",
  "signup",
  "dashboard",
  "resume",
  "portfolio",
  "portfolio-pro",
  "p",
  "public",
  "static",
  "assets",
  "docs",
  "contact",
  "pricing",
  "tarifs",
  "www",
] as const;

export const isReservedSlug = (slug: string): boolean =>
  (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());

/** ISO-8601 UTC with milliseconds, as every timestamp on the wire is. */
export const isoDateTimeSchema = z.iso.datetime();
