import {
  getBinaryLabelOptimizations,
  toAnnotationOptimizationConfig,
  getOptimizationBounds,
  getOptimizationValue,
  getOptimizationValueFromConfig,
} from "../optimizationUtils";
import type {
  AnnotationConfigCategorical,
  AnnotationConfigContinuous,
  AnnotationConfigFreeform,
} from "../types";

const continuousConfig: AnnotationConfigContinuous = {
  annotationType: "CONTINUOUS",
  name: "quality",
  lowerBound: 0,
  upperBound: 1,
  optimizationDirection: "MAXIMIZE",
};

const categoricalConfig: AnnotationConfigCategorical = {
  annotationType: "CATEGORICAL",
  name: "sentiment",
  optimizationDirection: "MAXIMIZE",
  values: [
    { label: "negative", score: 0 },
    { label: "neutral", score: 0.5 },
    { label: "positive", score: 1 },
  ],
};

const freeformConfig: AnnotationConfigFreeform = {
  annotationType: "FREEFORM",
  name: "notes",
};

describe("getOptimizationBounds", () => {
  it("returns undefined for all fields when config is undefined", () => {
    expect(getOptimizationBounds(undefined)).toEqual({
      lowerBound: undefined,
      upperBound: undefined,
      optimizationDirection: undefined,
      isThresholdHighSide: false,
    });
  });

  it("returns undefined for all fields when config is FREEFORM", () => {
    expect(getOptimizationBounds(freeformConfig)).toEqual({
      lowerBound: undefined,
      upperBound: undefined,
      optimizationDirection: undefined,
      isThresholdHighSide: false,
    });
  });

  it("extracts bounds directly from CONTINUOUS config", () => {
    expect(getOptimizationBounds(continuousConfig)).toEqual({
      lowerBound: 0,
      upperBound: 1,
      optimizationDirection: "MAXIMIZE",
      isThresholdHighSide: false,
    });
  });

  it("handles CONTINUOUS config with null bounds", () => {
    const config: AnnotationConfigContinuous = {
      ...continuousConfig,
      lowerBound: null,
      upperBound: null,
    };
    expect(getOptimizationBounds(config)).toEqual({
      lowerBound: undefined,
      upperBound: undefined,
      optimizationDirection: "MAXIMIZE",
      isThresholdHighSide: false,
    });
  });

  it("calculates bounds from CATEGORICAL config values", () => {
    expect(getOptimizationBounds(categoricalConfig)).toEqual({
      lowerBound: 0,
      upperBound: 1,
      optimizationDirection: "MAXIMIZE",
      isThresholdHighSide: false,
    });
  });

  it("handles CATEGORICAL config with no values", () => {
    const config: AnnotationConfigCategorical = {
      ...categoricalConfig,
      values: [],
    };
    expect(getOptimizationBounds(config)).toEqual({
      lowerBound: undefined,
      upperBound: undefined,
      optimizationDirection: "MAXIMIZE",
      isThresholdHighSide: false,
    });
  });

  it("handles CATEGORICAL config with null scores", () => {
    const config: AnnotationConfigCategorical = {
      ...categoricalConfig,
      values: [
        { label: "a", score: null },
        { label: "b", score: 5 },
        { label: "c", score: null },
      ],
    };
    expect(getOptimizationBounds(config)).toEqual({
      lowerBound: 5,
      upperBound: 5,
      optimizationDirection: "MAXIMIZE",
      isThresholdHighSide: false,
    });
  });

  it("normalizes NONE optimization direction to undefined", () => {
    const config: AnnotationConfigContinuous = {
      ...continuousConfig,
      optimizationDirection: "NONE",
    };
    expect(getOptimizationBounds(config)).toEqual({
      lowerBound: 0,
      upperBound: 1,
      optimizationDirection: undefined,
      isThresholdHighSide: false,
    });
  });

  it("handles MINIMIZE optimization direction", () => {
    const config: AnnotationConfigContinuous = {
      ...continuousConfig,
      optimizationDirection: "MINIMIZE",
    };
    expect(getOptimizationBounds(config)).toEqual({
      lowerBound: 0,
      upperBound: 1,
      optimizationDirection: "MINIMIZE",
      isThresholdHighSide: false,
    });
  });
});

describe("getOptimizationValue", () => {
  const unitMaximize = {
    lowerBound: 0,
    upperBound: 1,
    optimizationDirection: "MAXIMIZE" as const,
  };

  it("is neutral at the midpoint and reaches each end at its bound", () => {
    expect(getOptimizationValue({ ...unitMaximize, score: 0.5 })).toBe(0);
    expect(getOptimizationValue({ ...unitMaximize, score: 1 })).toBe(1);
    expect(getOptimizationValue({ ...unitMaximize, score: 0 })).toBe(-1);
    expect(getOptimizationValue({ ...unitMaximize, score: 0.75 })).toBeCloseTo(
      0.5
    );
  });

  it("reverses the gradient for minimize direction", () => {
    const minimize = {
      ...unitMaximize,
      optimizationDirection: "MINIMIZE" as const,
    };
    expect(getOptimizationValue({ ...minimize, score: 0 })).toBe(1);
    expect(getOptimizationValue({ ...minimize, score: 1 })).toBe(-1);
    expect(getOptimizationValue({ ...minimize, score: 0.25 })).toBeCloseTo(0.5);
  });

  it("scales each side of an off-center threshold to its own range", () => {
    const withThreshold = { ...unitMaximize, threshold: 0.8 };
    expect(getOptimizationValue({ ...withThreshold, score: 0.9 })).toBeCloseTo(
      0.5
    );
    expect(getOptimizationValue({ ...withThreshold, score: 0.4 })).toBeCloseTo(
      -0.5
    );
  });

  it("clamps scores outside the bounds", () => {
    expect(getOptimizationValue({ ...unitMaximize, score: 3 })).toBe(1);
    expect(getOptimizationValue({ ...unitMaximize, score: -3 })).toBe(-1);
  });

  it("saturates when the threshold sits on a bound", () => {
    const thresholdAtBest = { ...unitMaximize, threshold: 1 };
    expect(getOptimizationValue({ ...thresholdAtBest, score: 1 })).toBe(0);
    expect(getOptimizationValue({ ...thresholdAtBest, score: 1.5 })).toBe(1);
    expect(getOptimizationValue({ ...thresholdAtBest, score: 0.5 })).toBe(-0.5);
  });

  it("saturates a side of the pivot that has no bound", () => {
    const thresholdOnly = {
      lowerBound: undefined,
      upperBound: undefined,
      threshold: 0.5,
      optimizationDirection: "MAXIMIZE" as const,
    };
    expect(getOptimizationValue({ ...thresholdOnly, score: 0.9 })).toBe(1);
    expect(getOptimizationValue({ ...thresholdOnly, score: 0.1 })).toBe(-1);
    expect(getOptimizationValue({ ...thresholdOnly, score: 0.5 })).toBe(0);

    const upperOnly = { ...thresholdOnly, upperBound: 1 };
    expect(getOptimizationValue({ ...upperOnly, score: 0.75 })).toBeCloseTo(
      0.5
    );
    expect(getOptimizationValue({ ...upperOnly, score: 0.25 })).toBe(-1);
  });

  it("returns null without a pivot, a direction, or a score", () => {
    expect(
      getOptimizationValue({
        ...unitMaximize,
        upperBound: undefined,
        score: 0.9,
      })
    ).toBeNull();
    expect(
      getOptimizationValue({
        ...unitMaximize,
        optimizationDirection: undefined,
        score: 0.9,
      })
    ).toBeNull();
    expect(getOptimizationValue({ ...unitMaximize, score: null })).toBeNull();
  });
});

describe("getOptimizationValueFromConfig", () => {
  describe("a decision Yes / No output pivots on its threshold", () => {
    // The probability of true, labelled true at or above 0.8.
    const predicate = (
      optimizationDirection: "MAXIMIZE" | "MINIMIZE" | "NONE"
    ): AnnotationConfigContinuous => ({
      ...continuousConfig,
      optimizationDirection,
      threshold: 0.8,
    });

    it("marks a 0.7 bad when true is good, though it is above the midpoint", () => {
      const config = predicate("MAXIMIZE");
      expect(getOptimizationBounds(config).threshold).toBe(0.8);
      expect(
        getOptimizationValueFromConfig({ config, score: 0.7 })
      ).toBeLessThan(0);
      expect(
        getOptimizationValueFromConfig({ config, score: 0.9 })
      ).toBeGreaterThan(0);
    });

    it("marks a 0.7 good when false is good", () => {
      const config = predicate("MINIMIZE");
      expect(
        getOptimizationValueFromConfig({ config, score: 0.7 })
      ).toBeGreaterThan(0);
      expect(
        getOptimizationValueFromConfig({ config, score: 0.9 })
      ).toBeLessThan(0);
    });

    it("puts a score exactly at the threshold on its high side", () => {
      // 0.8 is labelled true: good when true is good, bad when false is.
      expect(
        getOptimizationValueFromConfig({
          config: predicate("MAXIMIZE"),
          score: 0.8,
        })
      ).toBeGreaterThan(0);
      expect(
        getOptimizationValueFromConfig({
          config: predicate("MINIMIZE"),
          score: 0.8,
        })
      ).toBeLessThan(0);
    });

    it("counts a certain Yes as true at a threshold of 1", () => {
      const config = { ...predicate("MAXIMIZE"), threshold: 1 };
      expect(getOptimizationValueFromConfig({ config, score: 1 })).toBe(1);
    });

    it("is neutral without a direction", () => {
      expect(
        getOptimizationValueFromConfig({
          config: predicate("NONE"),
          score: 0.7,
        })
      ).toBeNull();
    });

    it("leaves a continuous config without a threshold on its midpoint", () => {
      expect(
        getOptimizationValueFromConfig({ config: continuousConfig, score: 0.7 })
      ).toBeGreaterThan(0);
    });
  });

  it("grades a categorical score between its lowest and highest value scores", () => {
    expect(
      getOptimizationValueFromConfig({
        config: categoricalConfig,
        score: 0.75,
      })
    ).toBeCloseTo(0.5);
  });

  it("grades a continuous score between its bounds", () => {
    expect(
      getOptimizationValueFromConfig({
        config: continuousConfig,
        score: 0.25,
      })
    ).toBeCloseTo(-0.5);
  });

  it("saturates a freeform score against a threshold with no bounds", () => {
    const config: AnnotationConfigFreeform = {
      ...freeformConfig,
      optimizationDirection: "MINIMIZE",
      threshold: 100,
    };
    expect(getOptimizationValueFromConfig({ config, score: 50 })).toBe(1);
    expect(getOptimizationValueFromConfig({ config, score: 150 })).toBe(-1);
  });

  it("prefers a freeform threshold over the midpoint of its bounds", () => {
    const config: AnnotationConfigFreeform = {
      ...freeformConfig,
      optimizationDirection: "MAXIMIZE",
      threshold: 0.9,
      lowerBound: 0,
      upperBound: 1,
    };
    expect(
      getOptimizationValueFromConfig({ config, score: 0.75 })
    ).toBeLessThan(0);
  });

  it("returns null for a freeform config with neither a threshold nor both bounds", () => {
    expect(
      getOptimizationValueFromConfig({
        config: {
          ...freeformConfig,
          optimizationDirection: "MAXIMIZE",
          lowerBound: 0,
        },
        score: 5,
      })
    ).toBeNull();
  });

  it("returns null for an undirected config", () => {
    expect(
      getOptimizationValueFromConfig({
        config: { ...continuousConfig, optimizationDirection: "NONE" },
        score: 0.9,
      })
    ).toBeNull();
  });
});

describe("getBinaryLabelOptimizations", () => {
  const binaryConfig: AnnotationConfigCategorical = {
    annotationType: "CATEGORICAL",
    name: "correctness",
    optimizationDirection: "MAXIMIZE",
    values: [
      { label: "correct", score: 1 },
      { label: "incorrect", score: 0 },
    ],
  };

  it("maps each label to its polarity, aligned by the labels passed in", () => {
    expect(
      getBinaryLabelOptimizations({
        config: binaryConfig,
        labels: ["correct", "incorrect"],
      })
    ).toEqual([true, false]);
  });

  it("follows label order rather than config order", () => {
    expect(
      getBinaryLabelOptimizations({
        config: binaryConfig,
        labels: ["incorrect", "correct"],
      })
    ).toEqual([false, true]);
  });

  it("inverts polarity for MINIMIZE", () => {
    expect(
      getBinaryLabelOptimizations({
        config: { ...binaryConfig, optimizationDirection: "MINIMIZE" },
        labels: ["correct", "incorrect"],
      })
    ).toEqual([false, true]);
  });

  it("returns null when the distribution is not binary", () => {
    expect(
      getBinaryLabelOptimizations({
        config: categoricalConfig,
        labels: ["negative", "neutral", "positive"],
      })
    ).toBeNull();
    expect(
      getBinaryLabelOptimizations({
        config: binaryConfig,
        labels: ["correct"],
      })
    ).toBeNull();
  });

  it("returns null when no optimization direction is set", () => {
    expect(
      getBinaryLabelOptimizations({
        config: { ...binaryConfig, optimizationDirection: "NONE" },
        labels: ["correct", "incorrect"],
      })
    ).toBeNull();
  });

  it("returns null when the config is missing", () => {
    expect(
      getBinaryLabelOptimizations({
        config: undefined,
        labels: ["correct", "incorrect"],
      })
    ).toBeNull();
  });

  it("returns null when a charted label has no scored config value", () => {
    expect(
      getBinaryLabelOptimizations({
        config: binaryConfig,
        labels: ["correct", "unscored"],
      })
    ).toBeNull();
    expect(
      getBinaryLabelOptimizations({
        config: {
          ...binaryConfig,
          values: [
            { label: "correct", score: 1 },
            { label: "incorrect", score: null },
          ],
        },
        labels: ["correct", "incorrect"],
      })
    ).toBeNull();
  });

  it("returns null when a charted label's score sits exactly at the pivot", () => {
    // 'neutral' scores 0.5, the midpoint of the 0..1 scale: it is neither the
    // good nor the bad label, so the pair has no polarity to color.
    expect(
      getBinaryLabelOptimizations({
        config: categoricalConfig,
        labels: ["neutral", "positive"],
      })
    ).toBeNull();
  });

  it("returns null when both charted labels land on the same side of the pivot", () => {
    // The pivot comes from all three config values (midpoint 0.5), so a chart
    // showing only these two has no positive label to contrast against.
    expect(
      getBinaryLabelOptimizations({
        config: categoricalConfig,
        labels: ["negative", "neutral"],
      })
    ).toBeNull();
  });

  it("returns null when the two labels share a score", () => {
    expect(
      getBinaryLabelOptimizations({
        config: {
          ...binaryConfig,
          values: [
            { label: "correct", score: 1 },
            { label: "incorrect", score: 1 },
          ],
        },
        labels: ["correct", "incorrect"],
      })
    ).toBeNull();
  });
});

describe("toAnnotationOptimizationConfig", () => {
  it("carries the optimization metadata through", () => {
    expect(
      toAnnotationOptimizationConfig({
        annotationType: "CATEGORICAL",
        optimizationDirection: "MAXIMIZE",
        values: [{ label: "correct", score: 1 }],
      })
    ).toEqual({
      annotationType: "CATEGORICAL",
      optimizationDirection: "MAXIMIZE",
      lowerBound: undefined,
      upperBound: undefined,
      threshold: undefined,
      values: [{ label: "correct", score: 1 }],
    });
  });

  it("carries continuous bounds and a freeform threshold through", () => {
    expect(
      toAnnotationOptimizationConfig({
        annotationType: "CONTINUOUS",
        optimizationDirection: "MINIMIZE",
        lowerBound: 0,
        upperBound: 10,
      })
    ).toMatchObject({ lowerBound: 0, upperBound: 10 });
    expect(
      toAnnotationOptimizationConfig({
        annotationType: "FREEFORM",
        threshold: 0.7,
      })
    ).toMatchObject({ annotationType: "FREEFORM", threshold: 0.7 });
  });

  it("returns undefined without an annotation type", () => {
    // What an unmatched inline fragment leaves behind.
    expect(toAnnotationOptimizationConfig({})).toBeUndefined();
    expect(
      toAnnotationOptimizationConfig({ annotationType: null })
    ).toBeUndefined();
  });

  it("feeds the optimization helpers it is built for", () => {
    const config = toAnnotationOptimizationConfig({
      annotationType: "CATEGORICAL",
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "correct", score: 1 },
        { label: "incorrect", score: 0 },
      ],
    });
    expect(
      getBinaryLabelOptimizations({
        config,
        labels: ["correct", "incorrect"],
      })
    ).toEqual([true, false]);
  });
});

describe("a human annotation config's saved threshold", () => {
  // helpfulness_score: 0..10, Maximize, threshold 7, as the Settings dialog saves it.
  const helpfulness = toAnnotationOptimizationConfig({
    annotationType: "CONTINUOUS",
    optimizationDirection: "MAXIMIZE",
    lowerBound: 0,
    upperBound: 10,
    threshold: 7,
  });

  it("pivots good and bad on the threshold rather than the midpoint", () => {
    expect(getOptimizationBounds(helpfulness).threshold).toBe(7);
    expect(
      getOptimizationValueFromConfig({ config: helpfulness, score: 6 })
    ).toBeLessThan(0);
    expect(
      getOptimizationValueFromConfig({ config: helpfulness, score: 8 })
    ).toBeGreaterThan(0);
    // At the threshold is its high side, so good when maximizing.
    expect(
      getOptimizationValueFromConfig({ config: helpfulness, score: 7 })
    ).toBeGreaterThan(0);
  });

  it("falls back to the midpoint without one", () => {
    const unthresholded = toAnnotationOptimizationConfig({
      annotationType: "CONTINUOUS",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: 10,
      threshold: null,
    });
    expect(
      getOptimizationValueFromConfig({ config: unthresholded, score: 6 })
    ).toBeGreaterThan(0);
  });

  it("flips sides for a minimized config", () => {
    const latency = toAnnotationOptimizationConfig({
      annotationType: "CONTINUOUS",
      optimizationDirection: "MINIMIZE",
      lowerBound: 0,
      upperBound: 10,
      threshold: 3,
    });
    expect(
      getOptimizationValueFromConfig({ config: latency, score: 2 })
    ).toBeGreaterThan(0);
    expect(
      getOptimizationValueFromConfig({ config: latency, score: 4 })
    ).toBeLessThan(0);
    // At the threshold is its high side, so bad when minimizing.
    expect(
      getOptimizationValueFromConfig({ config: latency, score: 3 })
    ).toBeLessThan(0);
  });

  it("keeps a score at the midpoint neutral without one", () => {
    const unthresholded = toAnnotationOptimizationConfig({
      annotationType: "CONTINUOUS",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: 10,
      threshold: null,
    });
    expect(
      getOptimizationValueFromConfig({ config: unthresholded, score: 5 })
    ).toBe(0);
  });

  it("grows from the threshold without dipping just above it", () => {
    const at = getOptimizationValueFromConfig({
      config: helpfulness,
      score: 7,
    });
    const justAbove = getOptimizationValueFromConfig({
      config: helpfulness,
      score: 7.01,
    });
    expect(at).not.toBeNull();
    expect(justAbove).toBeGreaterThanOrEqual(at!);
    expect(
      getOptimizationValueFromConfig({ config: helpfulness, score: 10 })
    ).toBe(1);
    expect(
      getOptimizationValueFromConfig({ config: helpfulness, score: 8.5 })
    ).toBeCloseTo(0.5);
  });
});
