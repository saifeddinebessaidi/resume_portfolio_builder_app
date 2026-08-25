import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  EntitlementKey,
  type CreateExportRequest,
  type CreateProjectRequest,
  type ListProjectsQuery,
  type ListProjectsResponse,
  type ProjectDetail,
  type ProjectExportsResponse,
  type ProjectListItem,
  type ProjectVersionDetail,
  type ProjectVersionsResponse,
  type Publication as PublicationResponse,
  type PublishRequest,
  type UpdateProjectRequest,
  createExportRequestSchema,
  createProjectRequestSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
  publicUrlFor,
  publishRequestSchema,
  updateProjectRequestSchema,
  versionNumberParamSchema,
} from "@repo/contracts";

import { AppConfigService } from "../../../config/app-config.service";
import { CreateProjectUseCase } from "../application/create-project.use-case";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { EntitlementGuard } from "../../subscriptions/presentation/entitlement.guard";
import { ExportProjectUseCase } from "../application/export-project.use-case";
import {
  DeleteProjectUseCase,
  GetProjectUseCase,
  ListProjectsUseCase,
  ListVersionsUseCase,
  ProjectQuotaResolver,
  type ProjectQuota,
} from "../application/read-projects.use-cases";
import {
  PublishProjectUseCase,
  UnpublishProjectUseCase,
} from "../application/publish-project.use-case";
import { RequireEntitlement } from "../../subscriptions/presentation/require-entitlement.decorator";
import { UpdateProjectUseCase } from "../application/update-project.use-case";
import { isInitialVersion, type Project } from "../domain/project.entity";
import { type Publication } from "../domain/publication.entity";
import { type User } from "../../users/domain/user.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

@Controller("projects")
@UseGuards(EntitlementGuard)
export class ProjectsController {
  constructor(
    // The public link comes from configuration, not from the request's host: a link put into a
    // response has to be one the recipient can open, which is the web app's origin, not the API's.
    private readonly config: AppConfigService,
    private readonly createProject: CreateProjectUseCase,
    private readonly updateProject: UpdateProjectUseCase,
    private readonly listProjects: ListProjectsUseCase,
    private readonly getProject: GetProjectUseCase,
    private readonly deleteProject: DeleteProjectUseCase,
    private readonly listVersions: ListVersionsUseCase,
    private readonly exportProject: ExportProjectUseCase,
    private readonly publish: PublishProjectUseCase,
    private readonly unpublish: UnpublishProjectUseCase,
    private readonly quota: ProjectQuotaResolver,
  ) {}

  private publicUrlFor(publication: Publication | null): string | null {
    if (!publication?.isPublic) return null;
    return publicUrlFor(this.config.appPublicUrl, publication.slug);
  }

  private toListItem(
    project: Project,
    quota: ProjectQuota,
    publication: Publication | null,
  ): ProjectListItem {
    return {
      id: project.id,
      categoryCode: project.categoryCode,
      title: project.title,
      status: project.status,
      revisionCount: project.revisionCount,
      revisionLimit: quota.revisionLimit,
      exportCount: quota.exportCount,
      exportLimit: quota.exportLimit,
      completionPercent: quota.completionPercent,
      publicUrl: this.publicUrlFor(publication),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query(zodPipe(listProjectsQuerySchema)) query: ListProjectsQuery,
  ): Promise<ListProjectsResponse> {
    const page = await this.listProjects.execute({
      userId: user.id,
      category: query.category,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });

    const quotas = await this.quota.resolveMany(user.id, page.items);

    return {
      items: page.items.map((p) =>
        this.toListItem(
          p,
          quotas.get(p.id) ?? {
            revisionLimit: null,
            exportLimit: null,
            exportCount: 0,
            completionPercent: 0,
          },
          null,
        ),
      ),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * **No entitlement guard: creating is free.**
   *
   * The paywall moved to export and publication (ADR-0012), so anyone signed in may build. The use case
   * still meters `PROJECT_CREATE_QUOTA` when the user *has* a subscription, which keeps the advertised
   * "3 CVs per month" honest for paying customers.
   */
  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: User,
    @Body(zodPipe(createProjectRequestSchema)) body: CreateProjectRequest,
  ): Promise<ProjectDetail> {
    const project = await this.createProject.execute({
      actorUserId: user.id,
      categoryCode: body.categoryCode,
      title: body.title,
      data: body.data,
    });

    return this.detail(user, project.id);
  }

  @Get(":id")
  async get(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
  ): Promise<ProjectDetail> {
    return this.detail(user, params.id);
  }

  private async detail(user: User, projectId: string): Promise<ProjectDetail> {
    const { project, version, publication } = await this.getProject.execute(user.id, projectId);
    const quotas = await this.quota.resolveMany(user.id, [project]);
    const quota: ProjectQuota = quotas.get(project.id) ?? {
      revisionLimit: null,
      exportLimit: null,
      exportCount: 0,
      completionPercent: 0,
    };

    return {
      ...this.toListItem(project, quota, publication),
      currentVersion: version.versionNumber,
      schemaVersion: version.schemaVersion,
      data: version.data,
      lastOpenedAt: project.lastOpenedAt?.toISOString() ?? null,
    };
  }

  /** Editing is free as well; the revision cap applies only once a subscription exists. */
  @Patch(":id")
  async update(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
    @Body(zodPipe(updateProjectRequestSchema)) body: UpdateProjectRequest,
  ): Promise<ProjectDetail> {
    await this.updateProject.execute({
      actorUserId: user.id,
      projectId: params.id,
      title: body.title,
      status: body.status,
      data: body.data,
      expectedVersion: body.expectedVersion,
    });

    return this.detail(user, params.id);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
  ): Promise<void> {
    await this.deleteProject.execute(user.id, params.id);
  }

  @Get(":id/versions")
  async versions(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
  ): Promise<ProjectVersionsResponse> {
    const result = await this.listVersions.execute(user.id, params.id);

    return {
      items: result.versions.map((v) => ({
        versionNumber: v.versionNumber,
        schemaVersion: v.schemaVersion,
        createdAt: v.createdAt.toISOString(),
        isInitial: isInitialVersion(v.versionNumber),
      })),
      revisionCount: result.revisionCount,
      revisionLimit: result.revisionLimit,
    };
  }

  @Get(":id/versions/:versionNumber")
  async version(
    @CurrentUser() user: User,
    @Param(zodPipe(versionNumberParamSchema)) params: { id: string; versionNumber: number },
  ): Promise<ProjectVersionDetail> {
    // The use case scopes by owner; the param pipe has already coerced versionNumber to a number.
    const version = await this.listVersions.one(user.id, params.id, params.versionNumber);

    return {
      versionNumber: version.versionNumber,
      schemaVersion: version.schemaVersion,
      createdAt: version.createdAt.toISOString(),
      isInitial: isInitialVersion(version.versionNumber),
      data: version.data,
    };
  }

  @Post(":id/exports")
  @HttpCode(201)
  @RequireEntitlement({ key: EntitlementKey.EXPORT_PER_PROJECT, categoryFrom: "project" })
  async createExport(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
    @Body(zodPipe(createExportRequestSchema)) body: CreateExportRequest,
  ): Promise<ProjectExportsResponse> {
    await this.exportProject.execute({
      actorUserId: user.id,
      projectId: params.id,
      format: body.format,
    });

    return this.exportsFor(user, params.id);
  }

  @Get(":id/exports")
  async exports(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
  ): Promise<ProjectExportsResponse> {
    return this.exportsFor(user, params.id);
  }

  private async exportsFor(user: User, projectId: string): Promise<ProjectExportsResponse> {
    const result = await this.exportProject.list(user.id, projectId);

    return {
      items: result.items.map((e) => ({
        id: e.id,
        format: e.format as ProjectExportsResponse["items"][number]["format"],
        versionNumber: e.versionNumber,
        fileUrl: e.fileUrl,
        sizeBytes: e.sizeBytes,
        createdAt: e.createdAt.toISOString(),
      })),
      exportCount: result.exportCount,
      exportLimit: result.exportLimit,
    };
  }

  /**
   * **No `@RequireEntitlement` here, deliberately — it made re-publishing impossible.**
   *
   * This endpoint is publish *and* re-publish: `PublishProjectUseCase` looks for an existing
   * publication first and, when it finds one, updates `isPublic` and returns the same slug without
   * touching `PUBLICATION_SLOT`. Re-generating a link an owner already holds costs no quota, which is
   * the whole point of that branch.
   *
   * The guard cannot see that branch. It runs before the handler, reads the counter, and on a plan with
   * `PUBLICATION_SLOT = 1` refuses the moment the first publication exists — so the second press of
   * « Régénérer le lien » on an already-published portfolio returned
   * `403 ENTITLEMENT_EXHAUSTED — « Vous avez utilisé 1 sur 1 »`, for a request that would have spent
   * nothing. Un-publishing and re-publishing was locked out the same way.
   *
   * Dropping the guard costs nothing that matters. It is documented as *not* being the authority, and
   * every refusal it produced is still produced by the use case: `NoActiveSubscriptionError` before any
   * slug work, and `ConsumeEntitlementService` — inside the transaction, which is the real gate —
   * throwing the same `EntitlementExhaustedError`, with the same `limit`/`used`/`resetsAt`, when a
   * *first* publication would exceed the plan.
   */
  @Post(":id/publication")
  @HttpCode(201)
  async createPublication(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
    @Body(zodPipe(publishRequestSchema)) body: PublishRequest,
  ): Promise<PublicationResponse> {
    const publication = await this.publish.execute({
      actorUserId: user.id,
      projectId: params.id,
      slug: body.slug,
      isPublic: body.isPublic,
    });

    return {
      slug: publication.slug,
      publicUrl: publicUrlFor(this.config.appPublicUrl, publication.slug),
      isPublic: publication.isPublic,
      publishedAt: publication.publishedAt.toISOString(),
      expiresAt: publication.expiresAt?.toISOString() ?? null,
      viewCount: publication.viewCount,
    };
  }

  @Delete(":id/publication")
  @HttpCode(204)
  async removePublication(
    @CurrentUser() user: User,
    @Param(zodPipe(projectIdParamSchema)) params: { id: string },
  ): Promise<void> {
    await this.unpublish.execute(user.id, params.id);
  }
}
