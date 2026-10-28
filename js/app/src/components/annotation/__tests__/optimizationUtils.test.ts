import {
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
    });
  });

  it("returns undefined for all fields when config is FREEFORM", () => {
    expect(getOptimizationBounds(freeformConfig)).toEqual({
      lowerBound: undefined,
      upperBound: undefined,
      optimizationDirection: undefined,
    });
  });

  it("extracts bounds directly from CONTINUOUS config", () => {
    expect(getOptimizationBounds(continuousConfig)).toEqual({
      lowerBound: 0,
      upperBound: 1,
      optimizationDirection: "MAXIMIZE",
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
    });
  });

  it("calculates bounds from CATEGORICAL config values", () => {
    expect(getOptimizationBounds(categoricalConfig)).toEqual({
      lowerBound: 0,
      upperBound: 1,
      optimizationDirection: "MAXIMIZE",
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
