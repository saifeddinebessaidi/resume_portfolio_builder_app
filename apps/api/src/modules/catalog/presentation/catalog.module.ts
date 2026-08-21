import { Module } from "@nestjs/common";

import { CATALOG_REPOSITORY } from "../domain/catalog.repository";
import { CachedCatalogRepository } from "../infrastructure/cached-catalog.repository";
import { CatalogController } from "./catalog.controller";
import { GetCategoryPlansUseCase } from "../application/get-category-plans.use-case";
import { ListCategoriesUseCase } from "../application/list-categories.use-case";
import { PrismaCatalogRepository } from "../infrastructure/prisma-catalog.repository";

/**
 * The port is bound to the **cached** implementation, which wraps the Prisma one. Both are
 * registered because the decorator injects the inner repository by class.
 *
 * Swapping caching off for a test is this one `useClass`. Nothing above it changes, which is the
 * whole reason the decorator exists rather than an `if (cache)` inside the Prisma class.
 */
@Module({
  controllers: [CatalogController],
  providers: [
    ListCategoriesUseCase,
    GetCategoryPlansUseCase,
    PrismaCatalogRepository,
    { provide: CATALOG_REPOSITORY, useClass: CachedCatalogRepository },
  ],
  // The entitlement engine (step 08) and the dashboard summary (step 10) both resolve plans.
  exports: [CATALOG_REPOSITORY],
})
export class CatalogModule {}
