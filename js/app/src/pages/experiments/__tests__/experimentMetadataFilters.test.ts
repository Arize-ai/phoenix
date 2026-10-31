import { describe, expect, it } from "vitest";

import {
  formatMetadataFilter,
  METADATA_FILTERS_SEARCH_PARAM,
  parseMetadataFilterKey,
  parseMetadataFilterValue,
  readMetadataFiltersFromSearchParams,
  writeMetadataFiltersToSearchParams,
} from "../experimentMetadataFilters";

describe("parseMetadataFilterKey", () => {
  it("splits nested keys on dots", () => {
    expect(
      parseMetadataFilterKey(" harbor_agent.model_params.temperature ")
    ).toEqual(["harbor_agent", "model_params", "temperature"]);
  });

  it.each(["", "  ", "a..b", ".a", "a."])("rejects %j", (key) => {
    expect(parseMetadataFilterKey(key)).toBeNull();
  });
});

describe("parseMetadataFilterValue", () => {
  it.each([
    ["gpt-5", "gpt-5"],
    ["0.7", 0.7],
    ["3", 3],
    ["true", true],
    ["false", false],
    ['"0.7"', "0.7"],
    ['"true"', "true"],
    ["null", "null"],
    ["[1]", "[1]"],
    ["1e999", "1e999"],
  ])("reads %j as %j", (text, expected) => {
    expect(parseMetadataFilterValue(text)).toEqual(expected);
  });

  it("rejects blank text", () => {
    expect(parseMetadataFilterValue("   ")).toBeNull();
  });
});

describe("formatMetadataFilter", () => {
  it("quotes strings but not numbers or booleans", () => {
    expect(formatMetadataFilter({ path: ["model"], value: "gpt-5" })).toBe(
      'model == "gpt-5"'
    );
    expect(formatMetadataFilter({ path: ["a", "b"], value: 0.7 })).toBe(
      "a.b == 0.7"
    );
  });
});

describe("metadata filter search params", () => {
  it("round-trips filters and keeps other params", () => {
    const filters = [
      { path: ["model"], value: "gpt-5" },
      { path: ["params", "stream"], value: true },
    ];
    const params = writeMetadataFiltersToSearchParams(
      new URLSearchParams("tab=experiments"),
      filters
    );
    expect(params.get("tab")).toBe("experiments");
    expect(readMetadataFiltersFromSearchParams(params)).toEqual(filters);
  });

  it("removes the param when there are no filters", () => {
    const params = writeMetadataFiltersToSearchParams(
      new URLSearchParams(`${METADATA_FILTERS_SEARCH_PARAM}=[]`),
      []
    );
    expect(params.has(METADATA_FILTERS_SEARCH_PARAM)).toBe(false);
  });

  it("drops malformed filters", () => {
    const params = new URLSearchParams();
    params.set(
      METADATA_FILTERS_SEARCH_PARAM,
      JSON.stringify([
        { path: ["model"], value: "gpt-5" },
        { path: [], value: "x" },
        { path: ["a"], value: null },
        { path: [1], value: "x" },
        "junk",
      ])
    );
    expect(readMetadataFiltersFromSearchParams(params)).toEqual([
      { path: ["model"], value: "gpt-5" },
    ]);
  });

  it("ignores a param that isn't JSON", () => {
    const params = new URLSearchParams(`${METADATA_FILTERS_SEARCH_PARAM}=nope`);
    expect(readMetadataFiltersFromSearchParams(params)).toEqual([]);
  });
});
