import { Injectable, Logger } from "@nestjs/common";
import { type CategoryCode } from "@repo/contracts";

import { PrismaCatalogRepository } from "./prisma-catalog.repository";
import { type CatalogRepository } from "../domain/catalog.repository";
import { type Plan, type ProductCategory } from "../domain/catalog.entity";

/** Long, because the catalog changes when someone edits a plan — measured in months, not seconds. */
const TTL_MS = 5 * 60_000;

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * A caching decorator around `PrismaCatalogRepository`.
 *
 * Categories, plans and entitlements are read on nearly every request — the entitlement engine
 * consults them on every mutation — and written approximately never. On Neon's free tier, that is a
 * connection spent on data that has not changed since the process started.
 *
 * **The decorator pattern is doing real work here.** No use case knows caching exists: caching was
 * added by writing a new class and changing one binding, not by editing anything that already
 * worked. That is the open/closed principle spent rather than cited.
 *
 * In-process, so it is per-instance. Acceptable while the API runs as a single instance; the phase 10
 * runbook lists it alongside the rate limiter as the first things to move to Redis if that changes.
 */
@Injectable()
export class CachedCatalogRepository implements CatalogRepository {
  private readonly logger = new Logger(CachedCatalogRepository.name);
  private readonly cache = new Map<string, Entry>();

  constructor(private readonly inner: PrismaCatalogRepository) {}

  private async memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value as T;
    }

    const value = await load();
    this.cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  }

  findCategories(): Promise<ProductCategory[]> {
    return this.memo("categories", () => this.inner.findCategories());
  }

  findCategoryByCode(code: CategoryCode): Promise<ProductCategory | null> {
    return this.memo(`category:${code}`, () => this.inner.findCategoryByCode(code));
  }

  findPlansByCategory(code: CategoryCode): Promise<Plan[]> {
    return this.memo(`plans:${code}`, () => this.inner.findPlansByCategory(code));
  }

  findPlanByCode(code: string): Promise<Plan | null> {
    return this.memo(`plan:${code}`, () => this.inner.findPlanByCode(code));
  }

  /**
   * Clears everything rather than one key.
   *
   * A plan edit can change a category's plan list, a single plan and its entitlements at once, and
   * reasoning about which keys those touch is exactly the kind of bookkeeping that goes wrong
   * silently. The catalog is small and re-reading it is cheap.
   */
  invalidate(): void {
    this.cache.clear();
    this.logger.log("Catalog cache cleared");
  }
}
