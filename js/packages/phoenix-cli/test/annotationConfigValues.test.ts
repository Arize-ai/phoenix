import { describe, expect, it } from "vitest";

import {
  hasCategoricalValueInput,
  resolveCategoricalValues,
} from "../src/commands/annotationConfigValues";
import { InvalidArgumentError } from "../src/exitCodes";
import { collectString, parseNumberOption } from "../src/optionParsers";

describe("collectString", () => {
  it("appends without mutating the previous array", () => {
    const first = collectString("good=1", []);
    const second = collectString("bad=0", first);
    expect(first).toEqual(["good=1"]);
    expect(second).toEqual(["good=1", "bad=0"]);
    // previous array is untouched
    expect(first).toEqual(["good=1"]);
  });
});

describe("parseNumberOption", () => {
  it("parses integers, decimals, and negatives", () => {
    expect(parseNumberOption("1")).toBe(1);
    expect(parseNumberOption("-1.5")).toBe(-1.5);
    expect(parseNumberOption(" 0 ")).toBe(0);
  });

  it("yields NaN for garbage instead of truncating like parseFloat", () => {
    expect(parseNumberOption("abc")).toBeNaN();
    expect(parseNumberOption("1abc")).toBeNaN();
    expect(parseNumberOption("")).toBeNaN();
    expect(parseNumberOption("   ")).toBeNaN();
  });
});

describe("hasCategoricalValueInput", () => {
  it("is false when neither form is provided", () => {
    expect(hasCategoricalValueInput({})).toBe(false);
    expect(hasCategoricalValueInput({ value: [] })).toBe(false);
  });

  it("is true when either form is provided", () => {
    expect(hasCategoricalValueInput({ value: ["good=1"] })).toBe(true);
    expect(hasCategoricalValueInput({ values: "[]" })).toBe(true);
  });
});

describe("resolveCategoricalValues - repeatable --value", () => {
  it("parses label=score pairs", () => {
    expect(resolveCategoricalValues({ value: ["good=1", "bad=0"] })).toEqual([
      { label: "good", score: 1 },
      { label: "bad", score: 0 },
    ]);
  });

  it("allows a label with no score", () => {
    expect(resolveCategoricalValues({ value: ["needs-review"] })).toEqual([
      { label: "needs-review" },
    ]);
  });

  it("parses negative and decimal scores", () => {
    expect(resolveCategoricalValues({ value: ["low=-1.5"] })).toEqual([
      { label: "low", score: -1.5 },
    ]);
  });

  it("splits on the first '=' so a non-numeric remainder is a score error, not a label", () => {
    // 'a=b=1' -> label 'a', score text 'b=1' which is non-numeric -> throws
    expect(() => resolveCategoricalValues({ value: ["a=b=1"] })).toThrow(
      /non-numeric score/
    );
  });

  it("rejects an empty label before '='", () => {
    expect(() => resolveCategoricalValues({ value: ["=1"] })).toThrow(
      /missing a label/
    );
  });

  it("rejects an empty score after '='", () => {
    expect(() => resolveCategoricalValues({ value: ["good="] })).toThrow(
      /empty score/
    );
  });

  it("rejects a non-numeric score", () => {
    expect(() => resolveCategoricalValues({ value: ["good=high"] })).toThrow(
      /non-numeric score/
    );
  });
});

describe("resolveCategoricalValues - --values JSON", () => {
  it("parses a JSON array of label objects", () => {
    expect(
      resolveCategoricalValues({
        values: '[{"label":"good","score":1},{"label":"bad"}]',
      })
    ).toEqual([{ label: "good", score: 1 }, { label: "bad" }]);
  });

  it("rejects invalid JSON", () => {
    expect(() => resolveCategoricalValues({ values: "not json" })).toThrow(
      /valid JSON array/
    );
  });

  it("rejects a non-array payload", () => {
    expect(() =>
      resolveCategoricalValues({ values: '{"label":"good"}' })
    ).toThrow(/non-empty JSON array/);
  });

  it("rejects an empty array", () => {
    expect(() => resolveCategoricalValues({ values: "[]" })).toThrow(
      /non-empty JSON array/
    );
  });

  it("rejects entries missing a label", () => {
    expect(() => resolveCategoricalValues({ values: '[{"score":1}]' })).toThrow(
      /non-empty string "label"/
    );
  });

  it("rejects a non-numeric score", () => {
    expect(() =>
      resolveCategoricalValues({ values: '[{"label":"good","score":"high"}]' })
    ).toThrow(/must be a number/);
  });
});

describe("resolveCategoricalValues - precedence and absence", () => {
  it("returns undefined when neither form is provided", () => {
    expect(resolveCategoricalValues({})).toBeUndefined();
    expect(resolveCategoricalValues({ value: [] })).toBeUndefined();
  });

  it("rejects supplying both forms at once", () => {
    expect(() =>
      resolveCategoricalValues({
        value: ["good=1"],
        values: '[{"label":"good"}]',
      })
    ).toThrow(/not both/);
  });

  it("throws InvalidArgumentError so handlers exit with INVALID_ARGUMENT", () => {
    expect(() => resolveCategoricalValues({ value: ["good=abc"] })).toThrow(
      InvalidArgumentError
    );
    expect(() => resolveCategoricalValues({ values: "not json" })).toThrow(
      InvalidArgumentError
    );
    expect(() =>
      resolveCategoricalValues({ value: ["a=1"], values: "[]" })
    ).toThrow(InvalidArgumentError);
  });
});
