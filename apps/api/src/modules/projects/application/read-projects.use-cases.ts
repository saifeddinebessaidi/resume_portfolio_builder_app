import { Inject, Injectable } from "@nestjs/common";
import { EntitlementKey, type CategoryCode, type ProjectStatus } from "@repo/contracts";

import { CLOCK, type Clock } from "../../../common/clock/clock";
import { ConsumeEntitlementService } from "../../subscriptions/application/consume-entitlement.service";
import { NotFoundError } from "../../../common/errors/errors";
import { completionPercentFor } from "@repo/contracts";
import {
  PROJECT_REPOSITORY,
  PUBLICATION_REPOSITORY,
  type Page,
  type ProjectRepository,
} from "../domain/project.repository";
import { type PublicationRepository } from "../domain/publication.repository";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from "../../subscriptions/domain/subscription.repository";
import { type Project, type ProjectVersion } from "../domain/project.entity";
import { type Publication } from "../domain/publication.entity";

/**
 * The per-project quota numbers a response carries.
 *
 * Resolved together because a project row alone cannot answer "how many revisions are left" — that
 * needs the plan. Both limits come from the same place so the list and the detail view cannot
 * disagree.
 */
export interface ProjectQuota {
  revisionLimit: number | null;
  exportLimit: number | null;
  exportCount: number;
  /**
   * 0–100, from the stored payload. Resolved here with the quota numbers so the list and the detail
   * view report the same figure — the same reason both limits are resolved in one place.
   */
  completionPercent: number;
}

@Injectable()
export class ProjectQuotaResolver {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly consume: ConsumeEntitlementService,
  ) {}

  /**
   * Batched per category, so listing 20 projects does not resolve the plan 20 times.
   *
   * `exportCount` still needs one count per project — it is a per-resource limit — but the plan
   * lookup, which is the expensive part, happens once.
   */
  async resolveMany(userId: string, projects: Project[]): Promise<Map<string, ProjectQuota>> {
    const now = this.clock.now();
    const byCategory = new Map<CategoryCode, { revision: number | null; exports: number | null }>();

    for (const category of new Set(projects.map((p) => p.categoryCode))) {
      const subscription = await this.subs.findActiveFor(userId, category, now);

      if (!subscription) {
        // No active subscription: existing projects stay readable, so limits are reported as unknown
        // rather than zero — the project is not broken, the plan has simply lapsed.
        byCategory.set(category, { revision: null, exports: null });
        continue;
      }

      const revision = await this.consume.limitFor(
        subscription,
        EntitlementKey.REVISION_PER_PROJECT,
      );
      const exports = await this.consume.limitFor(subscription, EntitlementKey.EXPORT_PER_PROJECT);

      byCategory.set(category, {
        revision: revision?.limit ?? 0,
        exports: exports?.limit ?? 0,
      });
    }

    const result = new Map<string, ProjectQuota>();

    for (const project of projects) {
      const limits = byCategory.get(project.categoryCode);
      result.set(project.id, {
        revisionLimit: limits?.revision ?? null,
        exportLimit: limits?.exports ?? null,
        exportCount: await this.projects.countExports(project.id),
        completionPercent: completionPercentFor(project.categoryCode, project.currentVersionData),
      });
    }

    return result;
  }
}

@Injectable()
export class ListProjectsUseCase {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository) {}

  execute(args: {
    userId: string;
    category?: CategoryCode | undefined;
    status?: ProjectStatus | undefined;
    cursor?: string | undefined;
    limit: number;
  }): Promise<Page<Project>> {
    return this.projects.findManyForOwner(args);
  }
}

@Injectable()
export class GetProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(PUBLICATION_REPOSITORY) private readonly publications: PublicationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    projectId: string,
  ): Promise<{ project: Project; version: ProjectVersion; publication: Publication | null }> {
    const project = await this.projects.findByIdForOwner(projectId, userId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    const version = await this.projects.findCurrentVersion(project.id);
    if (!version) {
      // Every project gets version 1 in the same transaction as its own insert, so this is
      // unreachable unless the data was tampered with directly.
      throw new NotFoundError("Ce projet n'a aucune version enregistrée.");
    }

    const publication = await this.publications.findForProject(project.id);

    // Fire-and-forget: an analytics timestamp must never fail a read.
    void this.projects.touchLastOpened(project.id, this.clock.now());

    return { project, version, publication };
  }
}

@Injectable()
export class ListVersionsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly consume: ConsumeEntitlementService,
  ) {}

  async execute(
    userId: string,
    projectId: string,
  ): Promise<{ versions: ProjectVersion[]; revisionCount: number; revisionLimit: number | null }> {
    const project = await this.projects.findByIdForOwner(projectId, userId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    const subscription = await this.subs.findActiveFor(
      userId,
      project.categoryCode,
      this.clock.now(),
    );

    const definition = subscription
      ? await this.consume.limitFor(subscription, EntitlementKey.REVISION_PER_PROJECT)
      : undefined;

    return {
      versions: await this.projects.findVersions(project.id),
      revisionCount: project.revisionCount,
      revisionLimit: definition?.limit ?? null,
    };
  }

  async one(userId: string, projectId: string, versionNumber: number): Promise<ProjectVersion> {
    const project = await this.projects.findByIdForOwner(projectId, userId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    const version = await this.projects.findVersion(project.id, versionNumber);
    if (!version) throw new NotFoundError("Cette version est introuvable.");

    return version;
  }
}

@Injectable()
export class DeleteProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Soft delete, and **quota is not refunded.**
   *
   * The project was created and the allowance was spent. Refunding would make
   * create-delete-create a way to farm unlimited projects on a 3-project plan, and `deletedAt`
   * keeps the spend accountable.
   */
  async execute(userId: string, projectId: string): Promise<void> {
    const project = await this.projects.findByIdForOwner(projectId, userId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    await this.projects.softDelete(project.id, this.clock.now());
  }
}
