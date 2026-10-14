import { Inject, Injectable } from "@nestjs/common";
import { type AccessFeature, type CategoryCode } from "@repo/contracts";

import { FeatureDisabledError } from "../../../common/errors/errors";
import {
  ACCESS_OVERRIDES,
  type AccessOverrideReader,
  featureForCategory,
} from "../domain/access-override";

/**
 * Layer 4½: after the plan says yes, an admin can still say no for one user.
 *
 * Called from inside the use cases — the same place quota is enforced — so a new controller or a
 * second route to the same use case cannot forget it. Call it **before** `uow.run`: it reads on the
 * base client.
 */
@Injectable()
export class FeatureAccessService {
  constructor(@Inject(ACCESS_OVERRIDES) private readonly overrides: AccessOverrideReader) {}

  async disabledFeatures(userId: string): Promise<AccessFeature[]> {
    return this.overrides.disabledFeatures(userId);
  }

  /** Throws for the first disabled feature among `features`. One read however many are checked. */
  async assertEnabled(userId: string, ...features: AccessFeature[]): Promise<void> {
    const disabled = await this.overrides.disabledFeatures(userId);
    const blocked = features.find((f) => disabled.includes(f));
    if (blocked) throw new FeatureDisabledError(blocked);
  }

  /** The category's section switch plus any action-level ones, e.g. EXPORT. */
  async assertCategoryEnabled(
    userId: string,
    category: CategoryCode,
    ...actions: AccessFeature[]
  ): Promise<void> {
    await this.assertEnabled(userId, featureForCategory(category), ...actions);
  }
}
