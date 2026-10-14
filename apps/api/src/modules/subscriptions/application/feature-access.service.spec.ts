import { describe, expect, it } from "vitest";
import { type AccessFeature } from "@repo/contracts";

import { FeatureAccessService } from "./feature-access.service";
import { FeatureDisabledError } from "../../../common/errors/errors";

const serviceWith = (disabled: AccessFeature[]) =>
  new FeatureAccessService({
    disabledFeatures: () => Promise.resolve(disabled),
    limitOverridesFor: () => Promise.resolve([]),
  });

describe("FeatureAccessService", () => {
  it("allows everything when no override exists", async () => {
    await expect(serviceWith([]).assertCategoryEnabled("u1", "RESUME", "EXPORT")).resolves.toBe(
      undefined,
    );
  });

  it("blocks a disabled section", async () => {
    await expect(
      serviceWith(["PORTFOLIO"]).assertCategoryEnabled("u1", "PORTFOLIO"),
    ).rejects.toBeInstanceOf(FeatureDisabledError);
  });

  it("blocks a disabled action inside an enabled section", async () => {
    await expect(
      serviceWith(["EXPORT"]).assertCategoryEnabled("u1", "RESUME", "EXPORT"),
    ).rejects.toMatchObject({ code: "FEATURE_DISABLED", meta: { feature: "EXPORT" } });
  });

  it("does not block other sections", async () => {
    await expect(serviceWith(["PORTFOLIO"]).assertCategoryEnabled("u1", "RESUME")).resolves.toBe(
      undefined,
    );
  });
});
