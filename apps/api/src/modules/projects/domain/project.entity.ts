import { type CategoryCode, type ProjectStatus } from "@repo/contracts";

export interface Project {
  id: string;
  userId: string;
  categoryId: string;
  categoryCode: CategoryCode;
  subscriptionId: string | null;
  title: string;
  status: ProjectStatus;
  /**
   * Versions beyond the first. Creation writes version 1 and consumes create quota, not a
   * revision — otherwise a 1-revision plan would be exhausted before the user typed anything.
   */
  revisionCount: number;
  currentVersionId: string | null;
  currentVersionNumber: number;
  /**
   * The current version's payload, for read paths that need to *derive* something from it — today the
   * completion percentage on every list response.
   *
   * `{}` when the project somehow has no version. Carried on the entity rather than fetched per project
   * by whoever needs it, because the list query already reaches the version row for its number; adding
   * one column to that select is cheaper than N follow-up reads.
   */
  currentVersionData: Record<string, unknown>;
  lastOpenedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  data: Record<string, unknown>;
  schemaVersion: number;
  createdAt: Date;
}

/**
 * Whether one more revision may be written. `limit === null` is unlimited.
 *
 * A `>=` comparison, not `>`: with `revisionCount` at the limit the allowance is already spent.
 */
export const canRevise = (project: Project, limit: number | null): boolean =>
  limit === null || project.revisionCount < limit;

export const isOwnedBy = (project: Project, userId: string): boolean => project.userId === userId;

/** Version 1 is the creation. Revisions are 2..n, which is exactly `revisionCount`. */
export const isInitialVersion = (versionNumber: number): boolean => versionNumber === 1;

/** A default title so a builder can create an empty project without inventing a name. */
export function defaultTitleFor(categoryCode: CategoryCode): string {
  switch (categoryCode) {
    case "RESUME":
      return "Mon CV";
    case "PORTFOLIO":
      return "Mon portfolio";
    case "PORTFOLIO_PRO":
      return "Mon portfolio Pro";
  }
}
