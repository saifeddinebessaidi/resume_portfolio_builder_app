import { Injectable } from "@nestjs/common";
import { type ExportFormat, type Prisma } from "@prisma/client";
import { type CategoryCode, type ProjectStatus } from "@repo/contracts";

import { cursorWhere, decodeCursor, paginate } from "../../../common/pagination/cursor";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type Project, type ProjectVersion } from "../domain/project.entity";
import {
  type CreateProjectInput,
  type Page,
  type ProjectRepository,
  type WriteVersionInput,
} from "../domain/project.repository";
import { type Tx } from "../../subscriptions/domain/subscription.repository";

/** Everything a Project mapping needs: the category code and the current version's number. */
const PROJECT_INCLUDE = {
  category: { select: { code: true } },
  /**
   * `data` is selected alongside the version number so list responses can report completion without a
   * second read per project. It is the one heavy column here, and the cap that makes it affordable is
   * `MAX_PAYLOAD_BYTES` on the payload itself — a real CV is a few KB. If a list ever becomes slow, the
   * fix is to denormalise the percentage onto `Project`, not to fetch payloads lazily per row.
   */
  versions: {
    orderBy: { versionNumber: "desc" },
    take: 1,
    select: { versionNumber: true, data: true },
  },
} as const satisfies Prisma.ProjectInclude;

type Row = Prisma.ProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

function client(prisma: PrismaService, tx: Tx): Prisma.TransactionClient {
  return (tx as Prisma.TransactionClient | undefined) ?? prisma;
}

@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: Row): Project {
    return {
      id: row.id,
      userId: row.userId,
      categoryId: row.categoryId,
      categoryCode: row.category.code,
      subscriptionId: row.subscriptionId,
      title: row.title,
      status: row.status,
      revisionCount: row.revisionCount,
      currentVersionId: row.currentVersionId,
      currentVersionNumber: row.versions[0]?.versionNumber ?? 1,
      // Prisma types a Jsonb column as JsonValue, which includes scalars and null; the payload contract
      // guarantees an object, and anything else is treated as an empty payload rather than crashing a
      // list read for one malformed row.
      currentVersionData:
        typeof row.versions[0]?.data === "object" &&
        row.versions[0]?.data !== null &&
        !Array.isArray(row.versions[0]?.data)
          ? row.versions[0]?.data
          : {},
      lastOpenedAt: row.lastOpenedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  /**
   * `userId` and `deletedAt` are in the WHERE, not checked afterwards. That is the whole point of
   * this repository's shape: the unsafe query cannot be written.
   */
  async findByIdForOwner(id: string, userId: string): Promise<Project | null> {
    const row = await this.prisma.project.findFirst({
      where: { id, userId, deletedAt: null },
      include: PROJECT_INCLUDE,
    });

    return row ? this.toDomain(row) : null;
  }

  async findManyForOwner(args: {
    userId: string;
    category?: CategoryCode | undefined;
    status?: ProjectStatus | undefined;
    cursor?: string | undefined;
    limit: number;
  }): Promise<Page<Project>> {
    const cursor = decodeCursor(args.cursor);

    const rows = await this.prisma.project.findMany({
      where: {
        userId: args.userId,
        deletedAt: null,
        ...(args.category ? { category: { code: args.category } } : {}),
        ...(args.status ? { status: args.status } : {}),
        ...cursorWhere(cursor),
      },
      // Must match the cursor's sort exactly, or a page boundary silently drops rows.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // One extra row is how "is there another page?" is answered without a second count query.
      take: args.limit + 1,
      include: PROJECT_INCLUDE,
    });

    const page = paginate(rows, args.limit);

    return { items: page.items.map((r) => this.toDomain(r)), nextCursor: page.nextCursor };
  }

  async countForOwner(userId: string, category?: CategoryCode): Promise<number> {
    return this.prisma.project.count({
      where: {
        userId,
        deletedAt: null,
        ...(category ? { category: { code: category } } : {}),
      },
    });
  }

  async findRecentForOwner(
    userId: string,
    category: CategoryCode,
    take: number,
  ): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({
      where: { userId, deletedAt: null, category: { code: category } },
      orderBy: { updatedAt: "desc" },
      take,
      include: PROJECT_INCLUDE,
    });

    return rows.map((r) => this.toDomain(r));
  }

  /**
   * Project, version 1 and the pointer, in one transaction supplied by the caller — the same
   * transaction that consumed the quota. A project cannot exist without having been paid for, and a
   * spent allowance cannot survive a failed insert.
   */
  async create(tx: Tx, input: CreateProjectInput): Promise<Project> {
    const db = client(this.prisma, tx);

    const created = await db.project.create({
      data: {
        userId: input.userId,
        categoryId: input.categoryId,
        subscriptionId: input.subscriptionId,
        title: input.title,
        status: "DRAFT",
        // Version 1 is the creation and consumes create quota, not a revision.
        revisionCount: 0,
      },
    });

    const version = await db.projectVersion.create({
      data: {
        projectId: created.id,
        versionNumber: 1,
        data: input.data as Prisma.InputJsonValue,
        schemaVersion: input.schemaVersion,
        createdByUserId: input.userId,
      },
    });

    const row = await db.project.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
      include: PROJECT_INCLUDE,
    });

    return this.toDomain(row);
  }

  async writeVersion(tx: Tx, input: WriteVersionInput): Promise<Project> {
    const db = client(this.prisma, tx);

    // The @@unique([projectId, versionNumber]) constraint means two concurrent saves cannot both
    // claim version n: the loser gets a unique violation, which the filter maps to 409
    // VERSION_CONFLICT — exactly what a lost update is from the user's point of view.
    const version = await db.projectVersion.create({
      data: {
        projectId: input.projectId,
        versionNumber: input.versionNumber,
        data: input.data as Prisma.InputJsonValue,
        schemaVersion: input.schemaVersion,
        createdByUserId: input.createdByUserId,
      },
    });

    const row = await db.project.update({
      where: { id: input.projectId },
      data: {
        currentVersionId: version.id,
        revisionCount: { increment: 1 },
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: PROJECT_INCLUDE,
    });

    return this.toDomain(row);
  }

  async updateMetadata(
    id: string,
    input: { title?: string | undefined; status?: ProjectStatus | undefined },
  ): Promise<Project> {
    const row = await this.prisma.project.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: PROJECT_INCLUDE,
    });

    return this.toDomain(row);
  }

  /**
   * Soft delete: the row stays so the quota it consumed remains accountable. Deleting does not
   * refund, which is what blocks create-delete-create farming.
   */
  async softDelete(id: string, at: Date): Promise<void> {
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: at, status: "ARCHIVED" },
    });
  }

  async findVersions(projectId: string): Promise<ProjectVersion[]> {
    const rows = await this.prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { versionNumber: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      versionNumber: r.versionNumber,
      data: r.data as Record<string, unknown>,
      schemaVersion: r.schemaVersion,
      createdAt: r.createdAt,
    }));
  }

  async findVersion(projectId: string, versionNumber: number): Promise<ProjectVersion | null> {
    const row = await this.prisma.projectVersion.findUnique({
      where: { projectId_versionNumber: { projectId, versionNumber } },
    });

    if (!row) return null;

    return {
      id: row.id,
      projectId: row.projectId,
      versionNumber: row.versionNumber,
      data: row.data as Record<string, unknown>,
      schemaVersion: row.schemaVersion,
      createdAt: row.createdAt,
    };
  }

  async findCurrentVersion(projectId: string): Promise<ProjectVersion | null> {
    const row = await this.prisma.projectVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: "desc" },
    });

    if (!row) return null;

    return {
      id: row.id,
      projectId: row.projectId,
      versionNumber: row.versionNumber,
      data: row.data as Record<string, unknown>,
      schemaVersion: row.schemaVersion,
      createdAt: row.createdAt,
    };
  }

  /**
   * This count IS the enforcement of "1 téléchargement par CV".
   *
   * When `tx` is supplied the count runs inside that transaction, so it sees a row the same
   * transaction just inserted — which is what makes the post-insert verification a real gate rather
   * than a read of stale committed state.
   */
  countExports(projectId: string, tx?: Tx): Promise<number> {
    return client(this.prisma, tx).projectExport.count({ where: { projectId } });
  }

  async recordExport(
    tx: Tx,
    input: {
      projectId: string;
      projectVersionId: string;
      format: string;
      createdByUserId: string;
    },
  ): Promise<{ id: string; createdAt: Date }> {
    const row = await client(this.prisma, tx).projectExport.create({
      data: {
        projectId: input.projectId,
        projectVersionId: input.projectVersionId,
        format: input.format as ExportFormat,
        createdByUserId: input.createdByUserId,
      },
      select: { id: true, createdAt: true },
    });

    return row;
  }

  async findExports(projectId: string): Promise<
    {
      id: string;
      format: string;
      versionNumber: number;
      fileUrl: string | null;
      sizeBytes: number | null;
      createdAt: Date;
    }[]
  > {
    const rows = await this.prisma.projectExport.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { projectVersion: { select: { versionNumber: true } } },
    });

    return rows.map((r) => ({
      id: r.id,
      format: r.format,
      versionNumber: r.projectVersion.versionNumber,
      fileUrl: r.fileUrl,
      sizeBytes: r.sizeBytes,
      createdAt: r.createdAt,
    }));
  }

  async touchLastOpened(id: string, at: Date): Promise<void> {
    // updateMany so a concurrently soft-deleted project does not throw: recording that a project was
    // opened is never worth failing a read over.
    await this.prisma.project.updateMany({ where: { id }, data: { lastOpenedAt: at } });
  }
}
