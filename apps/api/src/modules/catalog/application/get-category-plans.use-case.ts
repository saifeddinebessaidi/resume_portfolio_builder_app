import { Inject, Injectable } from "@nestjs/common";
import { type CategoryCode } from "@repo/contracts";

import { CATALOG_REPOSITORY, type CatalogRepository } from "../domain/catalog.repository";
import { NotFoundError } from "../../../common/errors/errors";
import { type Plan, type ProductCategory } from "../domain/catalog.entity";

@Injectable()
export class GetCategoryPlansUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository) {}

  async execute(code: CategoryCode): Promise<{ category: ProductCategory; plans: Plan[] }> {
    const category = await this.catalog.findCategoryByCode(code);

    // An inactive category is treated as absent: `isActive: false` exists to hide a category from
    // the app without deleting its data, so leaking it through this endpoint would defeat the flag.
    if (!category?.isActive) throw new NotFoundError("Cette catégorie est introuvable.");

    const plans = await this.catalog.findPlansByCategory(code);

    return { category, plans };
  }
}
