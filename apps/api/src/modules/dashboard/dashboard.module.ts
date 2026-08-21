import { Module } from "@nestjs/common";

import { CatalogModule } from "../catalog/presentation/catalog.module";
import { DashboardController } from "./dashboard.controller";
import { ProjectsModule } from "../projects/presentation/projects.module";
import { SubscriptionsModule } from "../subscriptions/presentation/subscriptions.module";

/**
 * A read-only aggregate over three modules. It owns no repository and no use case of its own —
 * everything it needs is already exported by the modules that own it, which is what keeps this an
 * assembly of existing rules rather than a second implementation of them.
 */
@Module({
  imports: [SubscriptionsModule, ProjectsModule, CatalogModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
