import { Module } from "@nestjs/common";

import { CatalogModule } from "../../catalog/presentation/catalog.module";
import { CreateProjectUseCase } from "../application/create-project.use-case";
import {
  DeleteProjectUseCase,
  GetProjectUseCase,
  ListProjectsUseCase,
  ListVersionsUseCase,
  ProjectQuotaResolver,
} from "../application/read-projects.use-cases";
import { ExportProjectUseCase } from "../application/export-project.use-case";
import { GetPublicPublicationUseCase } from "../application/get-public-publication.use-case";
import { PROJECT_REPOSITORY, PUBLICATION_REPOSITORY } from "../domain/project.repository";
import { PrismaProjectRepository } from "../infrastructure/prisma-project.repository";
import { PrismaPublicationRepository } from "../infrastructure/prisma-publication.repository";
import { ProjectsController } from "./projects.controller";
import { PublicPublicationsController } from "./public-publications.controller";
import {
  PublishProjectUseCase,
  UnpublishProjectUseCase,
} from "../application/publish-project.use-case";
import { SubscriptionsModule } from "../../subscriptions/presentation/subscriptions.module";
import { TRANSACTION_RUNNER } from "../../subscriptions/domain/transaction-runner.port";
import { UnitOfWork } from "../../../infrastructure/prisma/unit-of-work";
import { UpdateProjectUseCase } from "../application/update-project.use-case";

/**
 * Depends on `SubscriptionsModule` — one direction only.
 *
 * Projects consume quota, so they need the engine. The engine does *not* import projects: it resolves
 * a project's category through `CATEGORY_RESOLVER`, which subscriptions provides itself. That is what
 * keeps this a dependency rather than a cycle needing `forwardRef`.
 */
@Module({
  imports: [SubscriptionsModule, CatalogModule],
  controllers: [ProjectsController, PublicPublicationsController],
  providers: [
    CreateProjectUseCase,
    UpdateProjectUseCase,
    ListProjectsUseCase,
    GetProjectUseCase,
    DeleteProjectUseCase,
    ListVersionsUseCase,
    ExportProjectUseCase,
    PublishProjectUseCase,
    UnpublishProjectUseCase,
    GetPublicPublicationUseCase,
    ProjectQuotaResolver,
    { provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository },
    { provide: PUBLICATION_REPOSITORY, useClass: PrismaPublicationRepository },
    { provide: TRANSACTION_RUNNER, useExisting: UnitOfWork },
  ],
  // The dashboard summary (step 10) reads projects and their quota numbers.
  exports: [PROJECT_REPOSITORY, PUBLICATION_REPOSITORY, ProjectQuotaResolver, ListProjectsUseCase],
})
export class ProjectsModule {}
