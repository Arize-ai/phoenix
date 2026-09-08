import {
  FLAGGED_LABEL,
  formatMatrixSubtitle,
  getKappaGloss,
  getPositiveLabel,
  NOT_FLAGGED_LABEL,
  toConfusionMatrixData,
} from "@phoenix/pages/project/evaluators/projectEvaluatorCompareUtils";

describe("project evaluator compare utils", () => {
  it("maps rows to A and columns to B while skipping zero cells", () => {
    expect(
      toConfusionMatrixData({
        matrix: [
          [3, 0],
          [1, 4],
        ],
        rowLabels: ["a1", "a2"],
        columnLabels: ["b1", "b2"],
      })
    ).toEqual([
      { actual: "a1", predicted: "b1", count: 3 },
      { actual: "a2", predicted: "b1", count: 1 },
      { actual: "a2", predicted: "b2", count: 4 },
    ]);
  });

  it("supports non-square and ragged matrices", () => {
    expect(
      toConfusionMatrixData({
        matrix: [[1, 2, 3], [4]],
        rowLabels: ["a1", "a2"],
        columnLabels: ["b1", "b2", "b3"],
      })
    ).toEqual([
      { actual: "a1", predicted: "b1", count: 1 },
      { actual: "a1", predicted: "b2", count: 2 },
      { actual: "a1", predicted: "b3", count: 3 },
      { actual: "a2", predicted: "b1", count: 4 },
    ]);
  });

  it.each([
    [null, null],
    [-0.01, "poor"],
    [0, "slight"],
    [0.2, "slight"],
    [0.4, "fair"],
    [0.6, "moderate"],
    [0.8, "substantial"],
    [0.81, "almost perfect"],
  ] as const)("glosses kappa %s as %s", (value, expected) => {
    expect(getKappaGloss(value)).toBe(expected);
  });

  it("only marks the exact binary flagged pair as positive", () => {
    expect(
      getPositiveLabel(
        [FLAGGED_LABEL, NOT_FLAGGED_LABEL],
        [NOT_FLAGGED_LABEL, FLAGGED_LABEL]
      )
    ).toBe(FLAGGED_LABEL);
    expect(
      getPositiveLabel([FLAGGED_LABEL, "other"], [FLAGGED_LABEL, "other"])
    ).toBeUndefined();
  });

  it("formats matrix thresholds", () => {
    expect(
      formatMatrixSubtitle({
        target: "SPAN",
        evaluatedByBoth: 12847,
        thresholdA: 0.5,
        thresholdB: 0.5,
      })
    ).toBe("12,847 spans evaluated by both · flagged at score ≥ 0.5");
    expect(
      formatMatrixSubtitle({
        target: "SESSION",
        evaluatedByBoth: 5,
        thresholdA: 0.5,
        thresholdB: 0.75,
      })
    ).toBe(
      "5 sessions evaluated by both · A flagged at score ≥ 0.5 · B flagged at score ≥ 0.75"
    );
  });
});
