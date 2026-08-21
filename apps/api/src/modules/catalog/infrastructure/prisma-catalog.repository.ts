import { Injectable } from "@nestjs/common";
import { type Prisma } from "@prisma/client";
// The enum fields map across without a cast: Prisma generates the same string unions the contract
// declares, and the step 03 parity check is what keeps that true. `currency` is the exception —
// @db.Char(3) types as a plain string — and `CategoryCode` is needed for the query parameter.
import { type CategoryCode, type Currency } from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type CatalogRepository } from "../domain/catalog.repository";
import { type Plan, type ProductCategory } from "../domain/catalog.entity";

/** The include shape every plan read shares, so the mapper always receives the same rows. */
const PLAN_INCLUDE = {
  category: true,
  features: { orderBy: { sortOrder: "asc" } },
  entitlements: { orderBy: { key: "asc" } },
} as const satisfies Prisma.PlanInclude;

type PlanRow = Prisma.PlanGetPayload<{ include: typeof PLAN_INCLUDE }>;
type CategoryRow = Prisma.ProductCategoryGetPayload<object>;

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toCategory(row: CategoryRow): ProductCategory {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      slug: row.slug,
      description: row.description,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  }

  private toPlan(row: PlanRow): Plan {
    return {
      id: row.id,
      code: row.code,
      categoryId: row.categoryId,
      categoryCode: row.category.code,
      name: row.name,
      billingPeriod: row.billingPeriod,
      durationDays: row.durationDays,
      priceMinor: row.priceMinor,
      // `@db.Char(3)` pads to a fixed width, so a shorter value would arrive with trailing spaces.
      currency: row.currency.trim() as Currency,
      badge: row.badge,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      features: row.features.map((f) => ({ label: f.label, sortOrder: f.sortOrder })),
      entitlements: row.entitlements.map((e) => ({
        key: e.key,
        limitValue: e.limitValue,
        resetPeriod: e.resetPeriod,
      })),
    };
  }

  async findCategories(): Promise<ProductCategory[]> {
    const rows = await this.prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => this.toCategory(r));
  }

  async findCategoryByCode(code: CategoryCode): Promise<ProductCategory | null> {
    const row = await this.prisma.productCategory.findUnique({ where: { code } });
    return row ? this.toCategory(row) : null;
  }

  async findPlansByCategory(code: CategoryCode): Promise<Plan[]> {
    const rows = await this.prisma.plan.findMany({
      where: { isActive: true, category: { code } },
      include: PLAN_INCLUDE,
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((r) => this.toPlan(r));
  }

  async findPlanByCode(code: string): Promise<Plan | null> {
    const row = await this.prisma.plan.findUnique({ where: { code }, include: PLAN_INCLUDE });
    return row ? this.toPlan(row) : null;
  }

  /** No-op: this repository holds nothing. The caching decorator overrides it. */
  invalidate(): void {
    // Intentionally empty.
  }
}
