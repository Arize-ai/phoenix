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
    {
      kind: "distribution",
      side: "b",
      view: "scores",
      label: "0–1",
      lowerBound: 0,
      upperBound: 1,
    },
    { kind: "distribution", side: "a", view: "scores", label: "0", score: 0 },
    { kind: "distribution", side: "a", view: "labels", label: "" },
    { kind: "flag", side: "b", flagged: false },
  ])("round trips $kind", (selection) => {
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
    '{"kind":"flag","side":"c","flagged":true}',
    '{"kind":"flag","side":"a","flagged":"false"}',
    '{"kind":"distribution","side":"a","view":"scores","label":"bad","score":1e999}',
    '{"kind":"distribution","side":"a","view":"scores","label":"bad"}',
    '{"kind":"distribution","side":"a","view":"scores","label":"bad","lowerBound":2,"upperBound":1}',
  ])("ignores malformed input %s", (input) =>
    expect(parseCompareSelection(input)).toBeNull()
  );
  it("formats labels without exposing the DSL", () => {
    expect(
      formatCompareSelection({
        selection: { kind: "matrix", a: "harmful", b: "profane" },
        evaluatorAName: "A",
        evaluatorBName: "B",
      })
    ).toBe("matrix: harmful ∩ profane");
  });
});
