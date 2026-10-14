import { describe, expect, it } from "vitest";

import { type PlanEntitlement } from "../../catalog/domain/catalog.entity";
import { applyLimitOverrides, featureForCategory } from "./access-override";

const plan: PlanEntitlement[] = [
  { key: "PROJECT_CREATE_QUOTA", limitValue: 3, resetPeriod: "MONTHLY" },
  { key: "EXPORT_PER_PROJECT", limitValue: 2, resetPeriod: "NONE" },
];

describe("applyLimitOverrides", () => {
  it("returns the plan unchanged when there are no overrides", () => {
    expect(applyLimitOverrides(plan, [])).toEqual(plan);
  });

  it("replaces the limit and keeps the plan's reset period", () => {
    const merged = applyLimitOverrides(plan, [{ key: "PROJECT_CREATE_QUOTA", limitValue: 10 }]);
    expect(merged).toContainEqual({
      key: "PROJECT_CREATE_QUOTA",
      limitValue: 10,
      resetPeriod: "MONTHLY",
    });
    expect(merged).toHaveLength(2);
  });

  it("keeps null (unlimited) and 0 (denied) distinct", () => {
    const merged = applyLimitOverrides(plan, [
      { key: "PROJECT_CREATE_QUOTA", limitValue: null },
      { key: "EXPORT_PER_PROJECT", limitValue: 0 },
    ]);
    expect(merged.find((e) => e.key === "PROJECT_CREATE_QUOTA")?.limitValue).toBeNull();
    expect(merged.find((e) => e.key === "EXPORT_PER_PROJECT")?.limitValue).toBe(0);
  });

  it("adds a key the plan does not declare, with a sensible reset period", () => {
    const merged = applyLimitOverrides(plan, [
      { key: "PUBLICATION_SLOT", limitValue: 1 },
      { key: "CUSTOM_SLUG", limitValue: 1 },
    ]);
    expect(merged).toContainEqual({ key: "PUBLICATION_SLOT", limitValue: 1, resetPeriod: "TERM" });
    expect(merged).toContainEqual({ key: "CUSTOM_SLUG", limitValue: 1, resetPeriod: "NONE" });
  });

  it("does not mutate the plan", () => {
    const copy = structuredClone(plan);
    applyLimitOverrides(plan, [{ key: "EXPORT_PER_PROJECT", limitValue: 9 }]);
    expect(plan).toEqual(copy);
  });
});

describe("featureForCategory", () => {
  it("maps each category to its section switch", () => {
    expect(featureForCategory("RESUME")).toBe("RESUME");
    expect(featureForCategory("PORTFOLIO")).toBe("PORTFOLIO");
    expect(featureForCategory("PORTFOLIO_PRO")).toBe("PORTFOLIO_PRO");
  });
});
