import { Controller, Get, Param } from "@nestjs/common";
import {
  type CategoriesResponse,
  type Category,
  type CategoryCode,
  type Plan as PlanResponse,
  type PlansResponse,
  categoryCodeParamSchema,
  categoryCodeSchema,
} from "@repo/contracts";

import { GetCategoryPlansUseCase } from "../application/get-category-plans.use-case";
import { ListCategoriesUseCase } from "../application/list-categories.use-case";
import { Public } from "../../../common/decorators/public.decorator";
import { type Plan, type ProductCategory } from "../domain/catalog.entity";
import { zodPipe } from "../../../common/pipes/zod-validation.pipe";

@Controller("catalog")
export class CatalogController {
  constructor(
    private readonly listCategories: ListCategoriesUseCase,
    private readonly getCategoryPlans: GetCategoryPlansUseCase,
  ) {}

  private toCategory(category: ProductCategory): Category {
    return {
      code: category.code,
      name: category.name,
      slug: category.slug,
      description: category.description,
      sortOrder: category.sortOrder,
    };
  }

  /**
   * Note what is absent: the internal `id`. The wire vocabulary is `code`, so a client cannot come
   * to depend on a database identifier — and the response is stable across a reseed.
   */
  private toPlan(plan: Plan): PlanResponse {
    return {
      code: plan.code,
      name: plan.name,
      categoryCode: plan.categoryCode,
      billingPeriod: plan.billingPeriod,
      durationDays: plan.durationDays,
      price: { amountMinor: plan.priceMinor, currency: plan.currency },
      badge: plan.badge,
      sortOrder: plan.sortOrder,
      features: plan.features,
      entitlements: plan.entitlements,
    };
  }

  /** Public: the pricing page renders this without a session. */
  @Public()
  @Get("categories")
  async categories(): Promise<CategoriesResponse> {
    const categories = await this.listCategories.execute();
    return { categories: categories.map((c) => this.toCategory(c)) };
  }

  /**
   * Returns the marketing `features[]` **and** the enforceable `entitlements[]` together.
   *
   * Deliberate: the pricing UI needs the bullets, the dashboard needs the numbers to render
   * "2 CV sur 3 utilisés", and serving both from one endpoint keeps the divergence between what is
   * advertised and what is enforced visible instead of hidden in two tables nobody compares.
   */
  @Public()
  @Get("categories/:code/plans")
  async plans(
    @Param(zodPipe(categoryCodeParamSchema)) params: { code: CategoryCode },
  ): Promise<PlansResponse> {
    const { category, plans } = await this.getCategoryPlans.execute(params.code);

    return {
      category: this.toCategory(category),
      plans: plans.map((p) => this.toPlan(p)),
    };
  }
}

// Re-exported so a future admin controller validates the same param the same way.
export { categoryCodeSchema };
