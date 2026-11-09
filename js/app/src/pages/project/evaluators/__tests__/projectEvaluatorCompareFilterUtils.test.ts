import { describe, expect, it } from "vitest";

import {
  buildCompareFilterCondition,
  isCompareSelectionValid,
  type CompareFilterSide,
} from "../projectEvaluatorCompareFilterUtils";

const sideA: CompareFilterSide = {
  annotationName: "A",
  labels: ["flagged", "not flagged"],
  threshold: 0.5,
  optimizationDirection: "MINIMIZE",
};
const sideB: CompareFilterSide = {
  ...sideA,
  annotationName: "B",
  optimizationDirection: "MAXIMIZE",
};
const categorical: CompareFilterSide = {
  annotationName: 'B"\\\n',
  labels: ["harmful", "safe", "other"],
  threshold: null,
  optimizationDirection: null,
};

describe("comparison filter populations", () => {
  it.each(["SPAN", "TRACE", "SESSION"] as const)(
    "requires both annotations to exist in %s scope",
    (target) => {
      const field =
        target === "SPAN"
          ? "annotations"
          : `${target.toLowerCase()}_annotations`;
      expect(
        buildCompareFilterCondition({ target, selection: null, sideA, sideB })
      ).toBe(`(${field}['A']) and (${field}['B'])`);
    }
  );
  it("includes the pivot when flagged and reverses maximize", () => {
    expect(
      buildCompareFilterCondition({
        target: "SPAN",
        selection: { kind: "matrix", a: "flagged", b: "flagged" },
        sideA,
        sideB,
      })
    ).toBe(
      "(annotations['A'].score >= 0.5) and (annotations['B'].score <= 0.5)"
    );
    expect(
      buildCompareFilterCondition({
        target: "SPAN",
        selection: { kind: "matrix", a: "not flagged", b: "not flagged" },
        sideA,
        sideB,
      })
    ).toBe("(annotations['A'].score < 0.5) and (annotations['B'].score > 0.5)");
  });
  it("excludes named labels and null from other", () => {
    const condition = buildCompareFilterCondition({
      target: "TRACE",
      selection: { kind: "matrix", a: "flagged", b: "other" },
      sideA,
      sideB: categorical,
    });
    expect(condition).toContain(".label is not None");
    expect(condition).toContain('.label != "harmful"');
    expect(condition).toContain('.label != "safe"');
    expect(condition).toContain('B"\\\\\\n');
  });
  it("invalidates labels removed by a time-range change", () => {
    const selection = { kind: "matrix", a: "missing", b: "flagged" } as const;
    expect(isCompareSelectionValid({ selection, sideA, sideB })).toBe(false);
    expect(
      buildCompareFilterCondition({ target: "SPAN", selection, sideA, sideB })
    ).toBe(
      buildCompareFilterCondition({
        target: "SPAN",
        selection: null,
        sideA,
        sideB,
      })
    );
  });
});
