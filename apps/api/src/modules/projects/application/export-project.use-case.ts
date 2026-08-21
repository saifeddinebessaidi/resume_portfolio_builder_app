import { Inject, Injectable } from "@nestjs/common";
import { EntitlementKey, type ExportFormat } from "@repo/contracts";

import { CLOCK, type Clock } from "../../../common/clock/clock";
import { ConsumeEntitlementService } from "../../subscriptions/application/consume-entitlement.service";
import {
  ExportLimitReachedError,
  NoActiveSubscriptionError,
  NotFoundError,
} from "../../../common/errors/errors";
import { PROJECT_REPOSITORY, type ProjectRepository } from "../domain/project.repository";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from "../../subscriptions/domain/subscription.repository";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";

export interface ExportCommand {
  actorUserId: string;
  projectId: string;
  format: ExportFormat;
}

export interface ExportResult {
  id: string;
  format: ExportFormat;
  versionNumber: number;
  fileUrl: string | null;
  createdAt: Date;
  exportCount: number;
  exportLimit: number | null;
}

/**
 * Records an export and enforces "1 téléchargement par CV".
 *
 * **The quota is enforced from now, before the PDF generator exists.** Phase 4 step 05 fills in real
 * rendering; this use case does not change when it does, because the rule and the file production are
 * separate concerns. Getting the rule in first means the advertised limit is real on day one rather
 * than being retrofitted onto a working download.
 */
@Injectable()
export class ExportProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subs: SubscriptionRepository,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly consume: ConsumeEntitlementService,
  ) {}

  async execute(command: ExportCommand): Promise<ExportResult> {
    const now = this.clock.now();

    const project = await this.projects.findByIdForOwner(command.projectId, command.actorUserId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    const subscription = await this.subs.findActiveFor(
      command.actorUserId,
      project.categoryCode,
      now,
    );
    if (!subscription) throw new NoActiveSubscriptionError(project.categoryCode);

    const version = await this.projects.findCurrentVersion(project.id);
    if (!version) throw new NotFoundError("Ce projet n'a aucune version à exporter.");

    /**
     * `EXPORT_PER_PROJECT` has `resetPeriod: NONE`, so it is counted on the resource:
     * `count(ProjectExport where projectId)`. Deny by default when the plan omits the key.
     */
    const definition = await this.consume.limitFor(subscription, EntitlementKey.EXPORT_PER_PROJECT);
    if (!definition) throw new ExportLimitReachedError(0, 0);

    const used = await this.projects.countExports(project.id);

    if (definition.limit !== null && used >= definition.limit) {
      throw new ExportLimitReachedError(definition.limit, used);
    }

    /**
     * Inside a transaction even though only one row is written.
     *
     * The count-then-insert above is a read-then-write, so two concurrent exports on a 1-export plan
     * could both read 0. The transaction plus the count re-read below is what closes that: the second
     * one sees the first's row and rolls back. This is the same shape as the counter path, using the
     * export rows themselves as the counter.
     */
    const recorded = await this.uow.run(async (tx) => {
      const row = await this.projects.recordExport(tx, {
        projectId: project.id,
        projectVersionId: version.id,
        format: command.format,
        createdByUserId: command.actorUserId,
      });

      // Counted INSIDE the transaction, so it sees the row just inserted. On the base client this
      // would read committed state only and the check would pass every time.
      const after = await this.projects.countExports(project.id, tx);
      if (definition.limit !== null && after > definition.limit) {
        throw new ExportLimitReachedError(definition.limit, definition.limit);
      }

      return { row, after };
    });

    return {
      id: recorded.row.id,
      format: command.format,
      versionNumber: version.versionNumber,
      // Real file production arrives in phase 4; the quota row is what matters now.
      fileUrl: null,
      createdAt: recorded.row.createdAt,
      exportCount: recorded.after,
      exportLimit: definition.limit,
    };
  }

  async list(
    userId: string,
    projectId: string,
  ): Promise<{
    items: {
      id: string;
      format: string;
      versionNumber: number;
      fileUrl: string | null;
      sizeBytes: number | null;
      createdAt: Date;
    }[];
    exportCount: number;
    exportLimit: number | null;
  }> {
    const project = await this.projects.findByIdForOwner(projectId, userId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    const subscription = await this.subs.findActiveFor(
      userId,
      project.categoryCode,
      this.clock.now(),
    );

    const definition = subscription
      ? await this.consume.limitFor(subscription, EntitlementKey.EXPORT_PER_PROJECT)
      : undefined;

    const items = await this.projects.findExports(project.id);

    return { items, exportCount: items.length, exportLimit: definition?.limit ?? null };
  }
}
