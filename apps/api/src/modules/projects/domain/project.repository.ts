import { type CategoryCode, type ProjectStatus } from "@repo/contracts";

import { type Project, type ProjectVersion } from "./project.entity";
import { type Tx } from "../../subscriptions/domain/subscription.repository";

export const PROJECT_REPOSITORY = Symbol("PROJECT_REPOSITORY");
export const PUBLICATION_REPOSITORY = Symbol("PUBLICATION_REPOSITORY");

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CreateProjectInput {
  userId: string;
  categoryId: string;
  /** null when the creator has no subscription — creating is free, downloading is not (ADR-0012). */
  subscriptionId: string | null;
  title: string;
  data: Record<string, unknown>;
  schemaVersion: number;
}

export interface WriteVersionInput {
  projectId: string;
  versionNumber: number;
  data: Record<string, unknown>;
  schemaVersion: number;
  createdByUserId: string;
  title?: string | undefined;
  status?: ProjectStatus | undefined;
}

/**
 * **Every read takes a `userId`, and there is deliberately no `findById(id)`.**
 *
 * Ownership is part of the lookup, not a check afterwards. Compare the alternative —
 * `findById(id)` then `if (p.userId !== actor.id) throw` — which is correct only as long as all ten
 * call sites remember the second line. Here the unsafe call cannot be written, because it does not
 * exist.
 *
 * Not-found and not-owned are therefore indistinguishable, and both surface as 404. A 403 would
 * confirm the id exists, which leaks existence across accounts.
 */
export interface ProjectRepository {
  findByIdForOwner(id: string, userId: string): Promise<Project | null>;

  findManyForOwner(args: {
    userId: string;
    category?: CategoryCode | undefined;
    status?: ProjectStatus | undefined;
    cursor?: string | undefined;
    limit: number;
  }): Promise<Page<Project>>;

  countForOwner(userId: string, category?: CategoryCode): Promise<number>;

  /** The dashboard's per-category slice: the most recent N, non-deleted. */
  findRecentForOwner(userId: string, category: CategoryCode, take: number): Promise<Project[]>;

  /** Creates the project AND version 1, then points `currentVersionId` at it. One transaction. */
  create(tx: Tx, input: CreateProjectInput): Promise<Project>;

  /** Appends a version and updates the project's pointer, count and metadata together. */
  writeVersion(tx: Tx, input: WriteVersionInput): Promise<Project>;

  /** Title/status only — no new version, no revision consumed. */
  updateMetadata(
    id: string,
    input: { title?: string | undefined; status?: ProjectStatus | undefined },
  ): Promise<Project>;

  /** Soft delete. Quota is deliberately NOT refunded. */
  softDelete(id: string, at: Date): Promise<void>;

  findVersions(projectId: string): Promise<ProjectVersion[]>;

  findVersion(projectId: string, versionNumber: number): Promise<ProjectVersion | null>;

  findCurrentVersion(projectId: string): Promise<ProjectVersion | null>;

  /**
   * `tx` is optional but load-bearing when supplied: the export limit is enforced by counting rows,
   * so the re-read after an insert has to happen **inside** the transaction. Counting on the base
   * client would not see the uncommitted row, making the check pass every time.
   */
  countExports(projectId: string, tx?: Tx): Promise<number>;

  recordExport(
    tx: Tx,
    input: {
      projectId: string;
      projectVersionId: string;
      format: string;
      createdByUserId: string;
    },
  ): Promise<{ id: string; createdAt: Date }>;

  findExports(projectId: string): Promise<
    {
      id: string;
      format: string;
      versionNumber: number;
      fileUrl: string | null;
      sizeBytes: number | null;
      createdAt: Date;
    }[]
  >;

  touchLastOpened(id: string, at: Date): Promise<void>;
}
