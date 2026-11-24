import { describe, expect, it } from "vitest";

import { shouldRestoreFilterConditionParam } from "../experimentsTableFilters";

describe("shouldRestoreFilterConditionParam", () => {
  it("restores an applied condition the URL dropped", () => {
    expect(
      shouldRestoreFilterConditionParam({
        urlCondition: "",
        appliedCondition: "repetitions > 1",
      })
    ).toBe(true);
  });

  it("leaves a condition the URL still carries", () => {
    expect(
      shouldRestoreFilterConditionParam({
        urlCondition: "repetitions >",
        appliedCondition: "repetitions > 1",
      })
    ).toBe(false);
  });

  it("leaves a URL with no condition when none is applied", () => {
    expect(
      shouldRestoreFilterConditionParam({
        urlCondition: "",
        appliedCondition: "",
      })
    ).toBe(false);
  });
});
