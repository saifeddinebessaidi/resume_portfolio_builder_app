import { Inject, Injectable } from "@nestjs/common";

import { CATALOG_REPOSITORY, type CatalogRepository } from "../domain/catalog.repository";
import { type ProductCategory } from "../domain/catalog.entity";

@Injectable()
export class ListCategoriesUseCase {
  constructor(@Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository) {}

  execute(): Promise<ProductCategory[]> {
    return this.catalog.findCategories();
  }
}
