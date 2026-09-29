import {
  formatMatrixSubtitle,
  getComparedOutputName,
  getFlagThresholdOperators,
  getKappaGloss,
  getLabelOptimalities,
  getLabelOptimalityColor,
  getPositionalOptimalities,
  NEUTRAL_LABEL_COLOR,
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

  it("only adds output identity for multi-output annotations", () => {
    expect(
      getComparedOutputName({
        evaluatorName: "response-quality",
        annotationName: "response-quality",
      })
    ).toBeNull();
    expect(
      getComparedOutputName({
        evaluatorName: "response-quality",
        annotationName: "response-quality.relevance",
      })
    ).toBe("relevance");
    expect(
      getComparedOutputName({
        evaluatorName: "response-quality",
        annotationName: "legacy-relevance",
      })
    ).toBe("legacy-relevance");
  });

  it("flags the pivot on the non-positive side of the direction", () => {
    expect(getFlagThresholdOperators("MAXIMIZE")).toEqual({
      flagged: "<=",
      unflagged: ">",
    });
    expect(getFlagThresholdOperators("MINIMIZE")).toEqual({
      flagged: ">=",
      unflagged: "<",
    });
    expect(getFlagThresholdOperators(null)).toEqual(
      getFlagThresholdOperators("MINIMIZE")
    );
  });

  it("formats matrix thresholds", () => {
    expect(
      formatMatrixSubtitle({
        target: "SPAN",
        populationSize: 12847,
        thresholdA: 0.5,
        thresholdB: 0.5,
        optimizationDirectionA: "MINIMIZE",
        optimizationDirectionB: "MINIMIZE",
      })
    ).toBe("12,847 spans evaluated by both · flagged at score ≥ 0.5");
    expect(
      formatMatrixSubtitle({
        target: "SPAN",
        populationSize: 40,
        thresholdA: 0.5,
        thresholdB: 0.5,
        optimizationDirectionA: "MAXIMIZE",
        optimizationDirectionB: "MINIMIZE",
      })
    ).toBe(
      "40 spans evaluated by both · A flagged at score ≤ 0.5 · B flagged at score ≥ 0.5"
    );
    expect(
      formatMatrixSubtitle({
        target: "SESSION",
        populationSize: 5,
        thresholdA: 0.5,
        thresholdB: 0.75,
        optimizationDirectionA: "MAXIMIZE",
        optimizationDirectionB: "MINIMIZE",
      })
    ).toBe(
      "5 sessions evaluated by both · A flagged at score ≤ 0.5 · B flagged at score ≥ 0.75"
    );
  });

  describe("getLabelOptimalities", () => {
    it("ranks a binary pair by direction", () => {
      expect(
        getLabelOptimalities({ direction: "MAXIMIZE", scores: [1, 0] })
      ).toEqual([1, 0]);
      expect(
        getLabelOptimalities({ direction: "MINIMIZE", scores: [1, 0] })
      ).toEqual([0, 1]);
    });

    it("spaces distinct scores evenly regardless of their values", () => {
      expect(
        getLabelOptimalities({
          direction: "MAXIMIZE",
          scores: [0, 0.9, 1, 0.9],
        })
      ).toEqual([0, 0.5, 1, 0.5]);
    });

    it("leaves unscored labels null", () => {
      expect(
        getLabelOptimalities({ direction: "MAXIMIZE", scores: [1, null, 0] })
      ).toEqual([1, null, 0]);
    });

    it("ranks a lone label on the configured scale", () => {
      expect(
        getLabelOptimalities({
          direction: "MINIMIZE",
          scores: [0],
          referenceScores: [1, 0],
        })
      ).toEqual([1]);
      expect(
        getLabelOptimalities({
          direction: "MINIMIZE",
          scores: [1],
          referenceScores: [1, 0],
        })
      ).toEqual([0]);
    });

    it("returns null without a direction or two distinct scores", () => {
      expect(
        getLabelOptimalities({ direction: "NONE", scores: [1, 0] })
      ).toBeNull();
      expect(
        getLabelOptimalities({ direction: null, scores: [1, 0] })
      ).toBeNull();
      expect(
        getLabelOptimalities({ direction: "MAXIMIZE", scores: [1, 1, null] })
      ).toBeNull();
    });
  });

  describe("getPositionalOptimalities", () => {
    it("spaces labels evenly from strongest to faintest", () => {
      expect(getPositionalOptimalities(3)).toEqual([1, 0.5, 0]);
      expect(getPositionalOptimalities(1)).toEqual([1]);
      expect(getPositionalOptimalities(0)).toEqual([]);
    });
  });

  describe("getLabelOptimalityColor", () => {
    it("takes the strongest step for the best label and the faintest for the worst", () => {
      expect(getLabelOptimalityColor({ hue: "blue", optimality: 1 })).toBe(
        "var(--global-color-blue-900)"
      );
      expect(getLabelOptimalityColor({ hue: "orange", optimality: 0 })).toBe(
        "var(--global-color-orange-400)"
      );
    });

    it("spreads labels in between across rounded palette steps", () => {
      expect(
        [1, 2 / 3, 1 / 3, 0].map((optimality) =>
          getLabelOptimalityColor({ hue: "blue", optimality })
        )
      ).toEqual([
        "var(--global-color-blue-900)",
        "var(--global-color-blue-700)",
        "var(--global-color-blue-600)",
        "var(--global-color-blue-400)",
      ]);
    });

    it("is neutral for a label without a score", () => {
      expect(getLabelOptimalityColor({ hue: "blue", optimality: null })).toBe(
        NEUTRAL_LABEL_COLOR
      );
    });
  });
});
