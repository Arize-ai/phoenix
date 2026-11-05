import { describe, expect, it } from "vitest";

import {
  getMetadataFilterCondition,
  parseMetadataFilterKey,
  parseMetadataFilterValue,
} from "../experimentFilterDSL";

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
    ["9300000000000000000", "9300000000000000000"],
    ["9007199254740991", 9007199254740991],
    ["1e20", "1e20"],
  ])("reads %j as %j", (text, expected) => {
    expect(parseMetadataFilterValue(text)).toEqual(expected);
  });

  it("rejects blank text", () => {
    expect(parseMetadataFilterValue("   ")).toBeNull();
  });
});

describe("getMetadataFilterCondition", () => {
  it.each([
    [{ path: ["model"], value: "gpt-5" }, 'metadata["model"] == "gpt-5"'],
    [{ path: ["a", "b"], value: 0.7 }, 'metadata["a"]["b"] == 0.7'],
    [{ path: ["stream"], value: true }, 'metadata["stream"] == True'],
    [{ path: ["stream"], value: false }, 'metadata["stream"] == False'],
    [{ path: ["n"], value: "0.7" }, 'metadata["n"] == "0.7"'],
    [
      { path: ['say "hi"'], value: "back\\slash" },
      'metadata["say \\"hi\\""] == "back\\\\slash"',
    ],
  ])("writes %j as %s", (filter, expected) => {
    expect(getMetadataFilterCondition(filter)).toBe(expected);
  });
});
