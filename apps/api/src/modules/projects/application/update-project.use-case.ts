import { Inject, Injectable } from "@nestjs/common";
import { type ProjectStatus, payloadSchemaFor, payloadVersionFor } from "@repo/contracts";

import {
  NotFoundError,
  ValidationFailedError,
  VersionConflictError,
} from "../../../common/errors/errors";
import { PROJECT_REPOSITORY, type ProjectRepository } from "../domain/project.repository";
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from "../../subscriptions/domain/transaction-runner.port";
import { type Project } from "../domain/project.entity";

export interface UpdateProjectCommand {
  actorUserId: string;
  projectId: string;
  title?: string | undefined;
  status?: ProjectStatus | undefined;
  data?: Record<string, unknown> | undefined;
  expectedVersion?: number | undefined;
}

@Injectable()
export class UpdateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(TRANSACTION_RUNNER) private readonly uow: TransactionRunner,
  ) {}

  async execute(command: UpdateProjectCommand): Promise<Project> {
    // Ownership is part of the lookup. Not-yours and not-found are the same 404.
    const project = await this.projects.findByIdForOwner(command.projectId, command.actorUserId);
    if (!project) throw new NotFoundError("Ce projet est introuvable.");

    /**
     * Optimistic concurrency.
     *
     * Still worth having with the cap gone: two tabs open on the same CV would otherwise silently
     * overwrite each other, and losing an afternoon's edits is a support ticket regardless of whether
     * a quota was involved.
     */
    if (
      command.expectedVersion !== undefined &&
      command.expectedVersion !== project.currentVersionNumber
    ) {
      throw new VersionConflictError(command.expectedVersion, project.currentVersionNumber);
    }

    /** A metadata-only edit writes no new version — renaming is not a revision. */
    if (command.data === undefined) {
      return this.projects.updateMetadata(project.id, {
        title: command.title,
        status: command.status,
      });
    }

    const parsed = payloadSchemaFor(project.categoryCode).safeParse(command.data);
    if (!parsed.success) {
      throw new ValidationFailedError(
        parsed.error.issues.map((i) => ({
          path: ["data", ...i.path.map(String)].join("."),
          message: i.message,
          code: i.code,
        })),
      );
    }

    /**
     * **Revisions are no longer capped.** (2026-08-07, ADR-0013.)
     *
     * The cap made sense when creating required a subscription. Since the paywall moved to delivery
     * (ADR-0012), charging for edits punishes exactly the behaviour the funnel depends on — a user
     * refining a CV they have not yet paid to download. It also made autosave impossible: one blur
     * would have spent a `RESUME_1M` holder's single allowance.
     *
     * `Project.revisionCount` still increments on every save. It is a **progress counter** now, not a
     * quota — the dashboard shows it, nothing enforces it, and the number stays available if a cap is
     * ever wanted again.
     */
    return this.uow.run(async (tx) =>
      this.projects.writeVersion(tx, {
        projectId: project.id,
        // The @@unique([projectId, versionNumber]) constraint is what stops two concurrent saves both
        // claiming this number — the loser's unique violation becomes a 409.
        versionNumber: project.currentVersionNumber + 1,
        data: parsed.data,
        schemaVersion: payloadVersionFor(project.categoryCode),
        createdByUserId: command.actorUserId,
        title: command.title,
        status: command.status,
      }),
    );
  }
}
