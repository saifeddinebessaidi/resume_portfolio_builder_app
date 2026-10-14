import { Injectable } from "@nestjs/common";
import { type AccessFeature } from "@repo/contracts";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { type AccessOverrideReader, type LimitOverride } from "../domain/access-override";

/**
 * Both tables are sparse and keyed by userId, so each read is one unique-index range scan. Not
 * cached: an admin switching a feature off must take effect on the user's very next request.
 */
@Injectable()
export class PrismaAccessOverrideReader implements AccessOverrideReader {
  constructor(private readonly prisma: PrismaService) {}

  async disabledFeatures(userId: string): Promise<AccessFeature[]> {
    const rows = await this.prisma.userAccessOverride.findMany({
      where: { userId, enabled: false },
      select: { feature: true },
    });
    return rows.map((r) => r.feature);
  }

  async limitOverridesFor(userId: string, categoryId: string): Promise<LimitOverride[]> {
    return this.prisma.userEntitlementOverride.findMany({
      where: { userId, categoryId },
      select: { key: true, limitValue: true },
    });
  }
}
