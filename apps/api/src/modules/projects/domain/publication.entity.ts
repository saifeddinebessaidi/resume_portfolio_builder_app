import { isReservedSlug } from "@repo/contracts";

export interface Publication {
  id: string;
  projectId: string;
  slug: string;
  isPublic: boolean;
  publishedAt: Date;
  unpublishedAt: Date | null;
  /** The hosting term, computed from the plan's HOSTING_DAYS. `null` = never expires. */
  expiresAt: Date | null;
  viewCount: number;
}

/**
 * Whether a visitor may see this.
 *
 * Duplicated deliberately in the repository query — the query is the enforcement (so a bug cannot
 * leak a draft), and this function is what a use case or a test reads. They must agree; phase 9
 * pins that.
 */
export const isLiveAt = (publication: Publication, now: Date): boolean =>
  publication.isPublic && (publication.expiresAt === null || publication.expiresAt > now);

/**
 * Turns a title into a URL-safe slug.
 *
 * Strips diacritics before removing non-alphanumerics, so "Portfolio Créatif" becomes
 * "portfolio-creatif" rather than "portfolio-cr-atif" — which matters because every title here is
 * French.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Slugs shorter than 3 chars, empty, or colliding with an app route are unusable. */
export const isUsableSlug = (slug: string): boolean => slug.length >= 3 && !isReservedSlug(slug);

/**
 * A deterministic fallback when a title slugifies to nothing usable — a title of only emoji, or
 * one that collides with a reserved word. Better than throwing at the user for a title they were
 * allowed to save.
 */
export const fallbackSlug = (seed: string): string => `p-${seed.slice(0, 8).toLowerCase()}`;
