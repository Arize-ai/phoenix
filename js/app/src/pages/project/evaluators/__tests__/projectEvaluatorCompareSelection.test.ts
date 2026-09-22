import { describe, expect, it } from "vitest";

import {
  encodeCompareSelection,
  formatCompareSelection,
  parseCompareSelection,
  type CompareSelection,
} from "../projectEvaluatorCompareSelection";

describe("comparison selection URL", () => {
  it.each<CompareSelection>([
    { kind: "matrix", a: 'quote" and \\ slash', b: "other" },
    { kind: "matrix", a: "", b: "" },
  ])("round trips $a ∩ $b", (selection) => {
    expect(parseCompareSelection(encodeCompareSelection(selection))).toEqual(
      selection
    );
  });
  it.each([
    null,
    "",
    "not json",
    "null",
    "[]",
    "1",
    "{}",
    '{"kind":"matrix","a":1,"b":"x"}',
    '{"kind":"matrix","a":"x"}',
    '{"kind":"flag","side":"a","flagged":true}',
  ])("ignores malformed input %s", (input) =>
    expect(parseCompareSelection(input)).toBeNull()
  );
  it("formats labels without exposing the DSL", () => {
    expect(
      formatCompareSelection({ kind: "matrix", a: "harmful", b: "profane" })
    ).toBe("matrix: harmful ∩ profane");
  });
});
