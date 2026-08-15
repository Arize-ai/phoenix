import {
  getOptimizationBounds,
  getPositiveOptimization,
  getPositiveOptimizationFromConfig,
} from "../optimizationUtils";
import type {
  AnnotationConfig,
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

describe("getPositiveOptimization", () => {
  it("returns null when score is null", () => {
    expect(
      getPositiveOptimization({
        score: null,
        lowerBound: 0,
        upperBound: 1,
        optimizationDirection: "MAXIMIZE",
      })
    ).toBeNull();
  });

  it("returns null when score is undefined", () => {
    expect(
      getPositiveOptimization({
        score: undefined,
        lowerBound: 0,
        upperBound: 1,
        optimizationDirection: "MAXIMIZE",
      })
    ).toBeNull();
  });

  it("returns null when bounds are undefined and no threshold", () => {
    expect(
      getPositiveOptimization({
        score: 0.5,
        lowerBound: undefined,
        upperBound: 1,
        optimizationDirection: "MAXIMIZE",
      })
    ).toBeNull();

    expect(
      getPositiveOptimization({
        score: 0.5,
        lowerBound: 0,
        upperBound: undefined,
        optimizationDirection: "MAXIMIZE",
      })
    ).toBeNull();
  });

  it("uses threshold as pivot when provided, ignoring bounds", () => {
    // MAXIMIZE + threshold=0.7: score=0.8 is positive, score=0.5 is negative
    expect(
      getPositiveOptimization({
        score: 0.8,
        lowerBound: undefined,
        upperBound: undefined,
        threshold: 0.7,
        optimizationDirection: "MAXIMIZE",
      })
    ).toBe(true);

    expect(
      getPositiveOptimization({
        score: 0.5,
        lowerBound: undefined,
        upperBound: undefined,
        threshold: 0.7,
        optimizationDirection: "MAXIMIZE",
      })
    ).toBe(false);

    // MINIMIZE + threshold=0.7: score=0.5 is positive, score=0.8 is negative
    expect(
      getPositiveOptimization({
        score: 0.5,
        lowerBound: undefined,
        upperBound: undefined,
        threshold: 0.7,
        optimizationDirection: "MINIMIZE",
      })
    ).toBe(true);

    expect(
      getPositiveOptimization({
        score: 0.8,
        lowerBound: undefined,
        upperBound: undefined,
        threshold: 0.7,
        optimizationDirection: "MINIMIZE",
      })
    ).toBe(false);
  });

  it("returns null when optimization direction is undefined", () => {
    expect(
      getPositiveOptimization({
        score: 0.5,
        lowerBound: 0,
        upperBound: 1,
        optimizationDirection: undefined,
      })
    ).toBeNull();
  });

  describe("MAXIMIZE direction", () => {
    // With bounds 0-1, midpoint is 0.5
    it("returns true when score is above the midpoint", () => {
      expect(
        getPositiveOptimization({
          score: 0.75,
          lowerBound: 0,
          upperBound: 1,
          optimizationDirection: "MAXIMIZE",
        })
      ).toBe(true);
    });

    it("returns true when score equals the upper bound", () => {
      expect(
        getPositiveOptimization({
          score: 1,
          lowerBound: 0,
          upperBound: 1,
          optimizationDirection: "MAXIMIZE",
        })
      ).toBe(true);
    });

    it("returns false when score equals the midpoint", () => {
      expect(
        getPositiveOptimization({
          score: 0.5,
          lowerBound: 0,
          upperBound: 1,
          optimizationDirection: "MAXIMIZE",
        })
      ).toBe(false);
    });

    it("returns false when score is below the midpoint", () => {
      expect(
        getPositiveOptimization({
          score: 0.25,
          lowerBound: 0,
          upperBound: 1,
          optimizationDirection: "MAXIMIZE",
        })
      ).toBe(false);
    });
  });

  describe("MINIMIZE direction", () => {
    // With bounds 0-1, midpoint is 0.5
    it("returns true when score is below the midpoint", () => {
      expect(
        getPositiveOptimization({
          score: 0.25,
          lowerBound: 0,
          upperBound: 1,
          optimizationDirection: "MINIMIZE",
        })
      ).toBe(true);
    });

    it("returns true when score equals the lower bound", () => {
      expect(
        getPositiveOptimization({
          score: 0,
          lowerBound: 0,
          upperBound: 1,
          optimizationDirection: "MINIMIZE",
        })
      ).toBe(true);
    });

    it("returns false when score equals the midpoint", () => {
      expect(
        getPositiveOptimization({
          score: 0.5,
          lowerBound: 0,
          upperBound: 1,
          optimizationDirection: "MINIMIZE",
        })
      ).toBe(false);
    });

    it("returns false when score is above the midpoint", () => {
      expect(
        getPositiveOptimization({
          score: 0.75,
          lowerBound: 0,
          upperBound: 1,
          optimizationDirection: "MINIMIZE",
        })
      ).toBe(false);
    });
  });
});

describe("getPositiveOptimizationFromConfig", () => {
  it("returns null when config is undefined", () => {
    expect(
      getPositiveOptimizationFromConfig({
        config: undefined,
        score: 1,
      })
    ).toBeNull();
  });

  it("returns null for FREEFORM config", () => {
    expect(
      getPositiveOptimizationFromConfig({
        config: freeformConfig,
        score: 1,
      })
    ).toBeNull();
  });

  describe("FREEFORM with threshold pivot", () => {
    it("returns true when MAXIMIZE score is above threshold", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "MAXIMIZE",
        threshold: 0.7,
      };
      expect(getPositiveOptimizationFromConfig({ config, score: 0.8 })).toBe(
        true
      );
    });

    it("returns false when MAXIMIZE score is below threshold", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "MAXIMIZE",
        threshold: 0.7,
      };
      expect(getPositiveOptimizationFromConfig({ config, score: 0.5 })).toBe(
        false
      );
    });

    it("returns true when MINIMIZE score is below threshold", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "latency",
        optimizationDirection: "MINIMIZE",
        threshold: 100,
      };
      expect(getPositiveOptimizationFromConfig({ config, score: 50 })).toBe(
        true
      );
    });

    it("prefers threshold over bounded midpoint when both are present", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "MAXIMIZE",
        threshold: 0.9,
        lowerBound: 0,
        upperBound: 1,
      };
      // Midpoint would be 0.5; threshold is 0.9. Score 0.75 < 0.9 → false.
      expect(getPositiveOptimizationFromConfig({ config, score: 0.75 })).toBe(
        false
      );
    });
  });

  describe("FREEFORM with bounded-midpoint fallback", () => {
    it("uses midpoint when both bounds are present and no threshold is set", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
        upperBound: 1,
      };
      // Midpoint 0.5: MAXIMIZE + score 0.75 → true.
      expect(getPositiveOptimizationFromConfig({ config, score: 0.75 })).toBe(
        true
      );
      expect(getPositiveOptimizationFromConfig({ config, score: 0.25 })).toBe(
        false
      );
    });

    it("uses midpoint with MINIMIZE direction", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "MINIMIZE",
        lowerBound: 0,
        upperBound: 10,
      };
      expect(getPositiveOptimizationFromConfig({ config, score: 2 })).toBe(
        true
      );
      expect(getPositiveOptimizationFromConfig({ config, score: 8 })).toBe(
        false
      );
    });
  });

  describe("FREEFORM with no valid pivot", () => {
    // Unbounded freeform without threshold MUST return null.
    it("returns null when only lowerBound is set", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "MAXIMIZE",
        lowerBound: 0,
      };
      expect(
        getPositiveOptimizationFromConfig({ config, score: 5 })
      ).toBeNull();
    });

    it("returns null when only upperBound is set", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "MAXIMIZE",
        upperBound: 1,
      };
      expect(
        getPositiveOptimizationFromConfig({ config, score: 0.5 })
      ).toBeNull();
    });

    it("returns null when optimizationDirection is NONE even with a threshold", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "NONE",
        threshold: 0.5,
      };
      expect(
        getPositiveOptimizationFromConfig({ config, score: 0.8 })
      ).toBeNull();
    });

    it("returns null when optimizationDirection is NONE with bounds set", () => {
      const config: AnnotationConfigFreeform = {
        annotationType: "FREEFORM",
        name: "score",
        optimizationDirection: "NONE",
        lowerBound: 0,
        upperBound: 1,
      };
      expect(
        getPositiveOptimizationFromConfig({ config, score: 0.8 })
      ).toBeNull();
    });
  });

  // Bounds are 0-1, so midpoint is 0.5
  it("returns true for score above midpoint with CONTINUOUS MAXIMIZE config", () => {
    expect(
      getPositiveOptimizationFromConfig({
        config: continuousConfig,
        score: 0.75,
      })
    ).toBe(true);
  });

  it("returns false for score at midpoint with CONTINUOUS MAXIMIZE config", () => {
    expect(
      getPositiveOptimizationFromConfig({
        config: continuousConfig,
        score: 0.5,
      })
    ).toBe(false);
  });

  it("returns false for score below midpoint with CONTINUOUS MAXIMIZE config", () => {
    expect(
      getPositiveOptimizationFromConfig({
        config: continuousConfig,
        score: 0.25,
      })
    ).toBe(false);
  });

  it("returns true for score above midpoint with CATEGORICAL MAXIMIZE config", () => {
    expect(
      getPositiveOptimizationFromConfig({
        config: categoricalConfig,
        score: 0.75,
      })
    ).toBe(true);
  });

  it("returns false for score at midpoint with CATEGORICAL MAXIMIZE config", () => {
    expect(
      getPositiveOptimizationFromConfig({
        config: categoricalConfig,
        score: 0.5,
      })
    ).toBe(false);
  });

  it("works with MINIMIZE direction", () => {
    const minimizeConfig: AnnotationConfig = {
      ...continuousConfig,
      optimizationDirection: "MINIMIZE",
    };

    // Score below midpoint (0.5) is positive for MINIMIZE
    expect(
      getPositiveOptimizationFromConfig({
        config: minimizeConfig,
        score: 0.25,
      })
    ).toBe(true);

    // Score at midpoint is not positive
    expect(
      getPositiveOptimizationFromConfig({
        config: minimizeConfig,
        score: 0.5,
      })
    ).toBe(false);

    // Score above midpoint is not positive for MINIMIZE
    expect(
      getPositiveOptimizationFromConfig({
        config: minimizeConfig,
        score: 0.75,
      })
    ).toBe(false);
  });
});
