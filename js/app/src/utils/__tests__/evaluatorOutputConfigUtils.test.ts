import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";

import {
  getContinuousThresholdDescription,
  getContinuousThresholdError,
  getEvaluatorOutputConfigType,
} from "../evaluatorOutputConfigUtils";

describe("getEvaluatorOutputConfigType", () => {
  const base = { name: "score", optimizationDirection: "MAXIMIZE" } as const;

  it("reads a config with values as categorical", () => {
    expect(
      getEvaluatorOutputConfigType({ ...base, values: [{ label: "a" }] })
    ).toBe("CATEGORICAL");
  });

  it("keeps a tagged continuous config with a threshold continuous", () => {
    expect(
      getEvaluatorOutputConfigType({
        ...base,
        annotationType: "CONTINUOUS",
        lowerBound: 0,
        upperBound: 10,
        threshold: 7,
      })
    ).toBe("CONTINUOUS");
  });

  it("reads a config copied from a query by its typename", () => {
    // Relay data copied into the store keeps its typename.
    const fromQuery = {
      ...base,
      __typename: "ContinuousAnnotationConfig",
      lowerBound: 0,
      upperBound: 1,
      threshold: null,
    } as unknown as AnnotationConfig;
    expect(getEvaluatorOutputConfigType(fromQuery)).toBe("CONTINUOUS");
    expect(
      getEvaluatorOutputConfigType({
        ...fromQuery,
        __typename: "FreeformAnnotationConfig",
      } as unknown as AnnotationConfig)
    ).toBe("FREEFORM");
  });

  it("falls back to the threshold key for untagged configs", () => {
    expect(
      getEvaluatorOutputConfigType({ ...base, lowerBound: 0, upperBound: 1 })
    ).toBe("CONTINUOUS");
    expect(getEvaluatorOutputConfigType({ ...base, threshold: null })).toBe(
      "FREEFORM"
    );
  });
});

describe("getContinuousThresholdError", () => {
  it.each([
    [7, 0, 10, null],
    [null, 0, 10, null],
    [Number.NaN, 0, 10, null],
    [1000, 0, null, null],
    [0, 0, 10, "Threshold must be greater than the lower bound"],
    [-1, 0, null, "Threshold must be greater than the lower bound"],
    [10, 0, 10, "Threshold must be less than the upper bound"],
    [11, null, 10, "Threshold must be less than the upper bound"],
    [Infinity, 0, 10, "Threshold must be a finite number"],
  ])(
    "threshold %s within %s..%s gives %s",
    (threshold, lowerBound, upperBound, expected) => {
      expect(
        getContinuousThresholdError({ threshold, lowerBound, upperBound })
      ).toBe(expected);
    }
  );
});

describe("getContinuousThresholdDescription", () => {
  it("names the good side for the direction", () => {
    expect(getContinuousThresholdDescription("MAXIMIZE")).toMatch(
      /^Good results are at or above this/
    );
    expect(getContinuousThresholdDescription("MINIMIZE")).toMatch(
      /^Good results are at or below this/
    );
    expect(getContinuousThresholdDescription("NONE")).toMatch(/midpoint/);
  });
});
