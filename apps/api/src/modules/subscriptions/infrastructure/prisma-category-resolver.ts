import { Injectable } from "@nestjs/common";
import { type CategoryCode } from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type CategoryResolver } from "../domain/category-resolver.port";

/**
 * Answers "which category does this project belong to?" for `EntitlementGuard`.
 *
 * It reads the `Project` table from the subscriptions module, which is a boundary crossing worth
 * naming. The alternative was for the projects module to provide this, but projects already depends
 * on subscriptions to consume quota — so that direction makes the two mutually dependent and Nest
 * needs `forwardRef`, which papers over a circular dependency rather than removing it.
 *
 * The read is deliberately minimal: one id, one column out, no project entity, no ownership
 * decision. Ownership is still enforced in the projects repository query, so a guard that resolved
 * someone else's project would gain nothing — the use case would still return 404.
 */
@Injectable()
export class PrismaCategoryResolver implements CategoryResolver {
  constructor(private readonly prisma: PrismaService) {}

  async categoryOfProject(projectId: string): Promise<CategoryCode | null> {
    const row = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { category: { select: { code: true } } },
    });

    return row?.category.code ?? null;
  }
}
