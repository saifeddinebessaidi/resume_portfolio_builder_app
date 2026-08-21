import { Injectable } from "@nestjs/common";
import { type Prisma, type ProjectPublication } from "@prisma/client";
import { type CategoryCode } from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type Publication } from "../domain/publication.entity";
import {
  type PublicPublicationView,
  type PublicationRepository,
} from "../domain/publication.repository";
import { type Tx } from "../../subscriptions/domain/subscription.repository";

function client(prisma: PrismaService, tx: Tx): Prisma.TransactionClient {
  return (tx as Prisma.TransactionClient | undefined) ?? prisma;
}

@Injectable()
export class PrismaPublicationRepository implements PublicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: ProjectPublication): Publication {
    return {
      id: row.id,
      projectId: row.projectId,
      slug: row.slug,
      isPublic: row.isPublic,
      publishedAt: row.publishedAt,
      unpublishedAt: row.unpublishedAt,
      expiresAt: row.expiresAt,
      viewCount: row.viewCount,
    };
  }

  async findForProject(projectId: string): Promise<Publication | null> {
    const row = await this.prisma.projectPublication.findUnique({ where: { projectId } });
    return row ? this.toDomain(row) : null;
  }

  /**
   * **The highest-risk query in the codebase.**
   *
   * Four predicates, every one load-bearing:
   *   - `slug` — what was asked for
   *   - `isPublic` — the owner can unpublish without losing the slug
   *   - `expiresAt` null or future — the hosting term, enforced HERE and not by a cron that might
   *     not have run
   *   - `project.deletedAt: null` — a soft-deleted project must go dark immediately
   *
   * And an **explicit `select`**, never a bare `include`: that is what stops a `userId`, an owner
   * email or a draft version leaking through a relation someone widens six months from now. The
   * version read is the one `currentVersionId` points at, so an unpublished draft cannot appear.
   */
  async findLiveBySlug(slug: string, now: Date): Promise<PublicPublicationView | null> {
    const row = await this.prisma.projectPublication.findFirst({
      where: {
        slug,
        isPublic: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        project: { deletedAt: null },
      },
      select: {
        slug: true,
        publishedAt: true,
        project: {
          select: {
            title: true,
            category: { select: { code: true } },
            // Only the owner's display name — never the email, never the id.
            user: { select: { fullName: true } },
            versions: {
              orderBy: { versionNumber: "desc" },
              take: 1,
              select: { data: true, schemaVersion: true },
            },
          },
        },
      },
    });

    if (!row) return null;

    const version = row.project.versions[0];
    if (!version) return null;

    return {
      slug: row.slug,
      title: row.project.title,
      categoryCode: row.project.category.code,
      data: version.data as Record<string, unknown>,
      schemaVersion: version.schemaVersion,
      publishedAt: row.publishedAt,
      ownerName: row.project.user.fullName,
    };
  }

  async slugExists(slug: string): Promise<boolean> {
    const found = await this.prisma.projectPublication.findUnique({
      where: { slug },
      select: { id: true },
    });
    return found !== null;
  }

  async create(
    tx: Tx,
    input: { projectId: string; slug: string; isPublic: boolean; expiresAt: Date | null },
  ): Promise<Publication> {
    const row = await client(this.prisma, tx).projectPublication.create({
      data: {
        projectId: input.projectId,
        slug: input.slug,
        isPublic: input.isPublic,
        expiresAt: input.expiresAt,
      },
    });

    return this.toDomain(row);
  }

  async update(
    id: string,
    input: {
      slug?: string | undefined;
      isPublic?: boolean | undefined;
      unpublishedAt?: Date | null;
    },
  ): Promise<Publication> {
    const row = await this.prisma.projectPublication.update({
      where: { id },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        ...(input.unpublishedAt !== undefined ? { unpublishedAt: input.unpublishedAt } : {}),
      },
    });

    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.projectPublication.delete({ where: { id } });
  }

  countLiveForOwner(userId: string, category: CategoryCode, now: Date): Promise<number> {
    return this.prisma.projectPublication.count({
      where: {
        isPublic: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        project: { userId, deletedAt: null, category: { code: category } },
      },
    });
  }

  /**
   * Two writes, one transaction: the detail row and the denormalised counter. The counter exists so
   * the owner's dashboard can show a view count without aggregating the detail table.
   */
  async recordView(
    slug: string,
    input: { ipHash: string | null; userAgent: string | null; referrer: string | null },
  ): Promise<boolean> {
    const publication = await this.prisma.projectPublication.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!publication) return false;

    await this.prisma.$transaction([
      this.prisma.publicationView.create({
        data: {
          publicationId: publication.id,
          ipHash: input.ipHash,
          userAgent: input.userAgent,
          referrer: input.referrer,
        },
      }),
      this.prisma.projectPublication.update({
        where: { id: publication.id },
        data: { viewCount: { increment: 1 } },
      }),
    ]);

    return true;
  }
}
