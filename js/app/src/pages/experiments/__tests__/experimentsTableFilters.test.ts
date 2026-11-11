import { describe, expect, it } from "vitest";

import {
  getExperimentsRefetchVariables,
  shouldRestoreFilterConditionParam,
} from "../experimentsTableFilters";

describe("getExperimentsRefetchVariables", () => {
  it("passes both the search text and the filter condition", () => {
    expect(
      getExperimentsRefetchVariables({
        searchText: "cold",
        filterCondition: 'metadata["model"] == "gpt-5"',
      })
    ).toEqual({
      filterCondition: "cold",
      experimentFilterCondition: 'metadata["model"] == "gpt-5"',
    });
  });

  it("sends null for an empty filter", () => {
    expect(
      getExperimentsRefetchVariables({ searchText: "", filterCondition: "" })
    ).toEqual({ filterCondition: null, experimentFilterCondition: null });
  });
});

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
