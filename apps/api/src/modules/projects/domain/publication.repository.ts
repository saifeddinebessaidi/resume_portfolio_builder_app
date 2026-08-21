import { type CategoryCode } from "@repo/contracts";

import { type Publication } from "./publication.entity";
import { type Tx } from "../../subscriptions/domain/subscription.repository";

/**
 * Exactly what a public page renders, and nothing else.
 *
 * Note what is absent: no `userId`, no owner email, no project id, no draft version. This type
 * crosses the authentication boundary, so every field in it is a deliberate decision to make that
 * field public — and the repository builds it with an explicit `select`, never a bare `include` that
 * someone could widen later.
 */
export interface PublicPublicationView {
  slug: string;
  title: string;
  categoryCode: CategoryCode;
  data: Record<string, unknown>;
  schemaVersion: number;
  publishedAt: Date;
  ownerName: string | null;
}

export interface PublicationRepository {
  findForProject(projectId: string): Promise<Publication | null>;

  /**
   * The highest-risk query in the codebase. Four predicates, all load-bearing: the slug, published,
   * still live, and the project not soft-deleted. **Expiry is enforced by the query**, not by a cron
   * that might not have run.
   */
  findLiveBySlug(slug: string, now: Date): Promise<PublicPublicationView | null>;

  /** True if any publication already holds this slug — the slug column is globally unique. */
  slugExists(slug: string): Promise<boolean>;

  create(
    tx: Tx,
    input: { projectId: string; slug: string; isPublic: boolean; expiresAt: Date | null },
  ): Promise<Publication>;

  update(
    id: string,
    input: {
      slug?: string | undefined;
      isPublic?: boolean | undefined;
      unpublishedAt?: Date | null;
    },
  ): Promise<Publication>;

  delete(id: string): Promise<void>;

  /** How many live publications this user holds — checked against PUBLICATION_SLOT. */
  countLiveForOwner(userId: string, category: CategoryCode, now: Date): Promise<number>;

  /** Records a view and bumps the denormalised counter. Fire-and-forget from the caller's view. */
  recordView(
    slug: string,
    input: { ipHash: string | null; userAgent: string | null; referrer: string | null },
  ): Promise<boolean>;
}
