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
  distribution: {
    threshold: 0.5,
    allEvaluatedMeanScore: 0,
    scoreBinCounts: null,
    scoreBinEdges: null,
    labelCounts: null,
    scoreValueCounts: [{ score: 0, count: 1 }],
  },
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
    "uses %s annotation scope",
    (target) => {
      const field =
        target === "SPAN"
          ? "annotations"
          : `${target.toLowerCase()}_annotations`;
      expect(
        buildCompareFilterCondition({ target, selection: null, sideA, sideB })
      ).toBe(
        `(${field}['A'].score is not None or ${field}['A'].label is not None) and (${field}['B'].score is not None or ${field}['B'].label is not None)`
      );
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
  it("distribution score zero includes evaluator-only targets", () => {
    expect(
      buildCompareFilterCondition({
        target: "SESSION",
        selection: {
          kind: "distribution",
          side: "a",
          view: "scores",
          label: "0",
          score: 0,
        },
        sideA,
        sideB,
      })
    ).toBe("session_annotations['A'].score == 0");
  });
  it("keeps the other side evaluated for a flag selection", () => {
    const condition = buildCompareFilterCondition({
      target: "SPAN",
      selection: { kind: "flag", side: "a", flagged: true },
      sideA,
      sideB,
    });
    expect(condition).toContain("annotations['A'].score >= 0.5");
    expect(condition).toContain("annotations['B'].label is not None");
  });
  it("includes the upper edge of the last histogram bin", () => {
    const side = {
      ...sideA,
      distribution: {
        ...sideA.distribution!,
        scoreValueCounts: null,
        scoreBinEdges: [0, 0.5, 1],
        scoreBinCounts: [1, 1],
      },
    };
    const selection = {
      kind: "distribution",
      side: "a",
      view: "scores",
      label: "0.50–1.00",
      lowerBound: 0.5,
      upperBound: 1,
    } as const;
    expect(
      buildCompareFilterCondition({
        target: "SPAN",
        selection,
        sideA: side,
        sideB,
      })
    ).toBe("annotations['A'].score >= 0.5 and annotations['A'].score <= 1");
  });
  it("invalidates removed distribution values", () => {
    expect(
      isCompareSelectionValid({
        selection: {
          kind: "distribution",
          side: "a",
          view: "scores",
          label: "2",
          score: 2,
        },
        sideA,
        sideB,
      })
    ).toBe(false);
  });
  it("uses raw empty labels rather than display text", () => {
    const side = {
      ...sideA,
      distribution: {
        ...sideA.distribution!,
        labelCounts: [{ label: "", count: 1, score: null, isOther: false }],
      },
    };
    expect(
      buildCompareFilterCondition({
        target: "SPAN",
        selection: {
          kind: "distribution",
          side: "a",
          view: "labels",
          label: "(empty label)",
        },
        sideA: side,
        sideB,
      })
    ).toBe(`annotations['A'].label == ""`);
  });
  it("filters a grouped distribution label against its full-population labels", () => {
    const side = {
      ...sideA,
      distribution: {
        ...sideA.distribution!,
        labelCounts: [
          { label: "only on A", score: null, count: 1, isOther: false },
          { label: "other", score: null, count: 3, isOther: true },
        ],
      },
    };
    expect(
      buildCompareFilterCondition({
        target: "TRACE",
        selection: {
          kind: "distribution",
          side: "a",
          view: "labels",
          label: "Other labels (grouped)",
        },
        sideA: side,
        sideB,
      })
    ).toBe(
      `trace_annotations['A'].label is not None and trace_annotations['A'].label != "only on A"`
    );
  });
});
