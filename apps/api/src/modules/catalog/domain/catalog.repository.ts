import { type CategoryCode } from "@repo/contracts";

import { type Plan, type ProductCategory } from "./catalog.entity";

export const CATALOG_REPOSITORY = Symbol("CATALOG_REPOSITORY");

/**
 * Reads of the catalog. There is deliberately no write method: the catalog is populated by the
 * idempotent seed, and an admin editing surface (phase 8) will add its own port rather than widening
 * this one — interface segregation, so a read path cannot accidentally acquire the ability to write.
 */
export interface CatalogRepository {
  /** Active categories, in `sortOrder`. */
  findCategories(): Promise<ProductCategory[]>;

  findCategoryByCode(code: CategoryCode): Promise<ProductCategory | null>;

  /** Active plans for a category, in `sortOrder`, with features and entitlements loaded. */
  findPlansByCategory(code: CategoryCode): Promise<Plan[]>;

  /**
   * By business code, e.g. `RESUME_6M`. Returns inactive plans too: an admin granting a
   * subscription against a retired plan needs to get `PLAN_INACTIVE`, which requires finding it
   * first. Filtering here would produce a misleading `NOT_FOUND`.
   */
  findPlanByCode(code: string): Promise<Plan | null>;

  /** Drops any cached copy. Called after an admin write so the next read is fresh. */
  invalidate(): void;
}
