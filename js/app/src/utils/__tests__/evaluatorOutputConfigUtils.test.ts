import {
  getContinuousThresholdDescription,
  getContinuousThresholdError,
  getEvaluatorOutputConfigType,
  toEvaluatorStoreOutputConfig,
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
});

describe("toEvaluatorStoreOutputConfig", () => {
  it("tags a selected config with the type its typename names", () => {
    const selected = {
      name: "score",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: 10,
      threshold: 7,
    };
    const continuous = toEvaluatorStoreOutputConfig({
      ...selected,
      __typename: "ContinuousAnnotationConfig",
    });
    expect(continuous).toEqual({
      annotationType: "CONTINUOUS",
      ...selected,
    });
    expect(getEvaluatorOutputConfigType(continuous!)).toBe("CONTINUOUS");
    // A continuous config with no threshold is still continuous.
    expect(
      getEvaluatorOutputConfigType(
        toEvaluatorStoreOutputConfig({
          ...selected,
          threshold: null,
          __typename: "ContinuousAnnotationConfig",
        })!
      )
    ).toBe("CONTINUOUS");
    const freeform = toEvaluatorStoreOutputConfig({
      ...selected,
      __typename: "FreeformAnnotationConfig",
    });
    expect(getEvaluatorOutputConfigType(freeform!)).toBe("FREEFORM");
  });

  it("keeps a categorical config's values", () => {
    const categorical = toEvaluatorStoreOutputConfig({
      __typename: "CategoricalAnnotationConfig",
      name: "verdict",
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "pass", score: 1 },
        { label: "fail", score: null },
      ],
    });
    expect(categorical).toEqual({
      name: "verdict",
      optimizationDirection: "MAXIMIZE",
      values: [{ label: "pass", score: 1 }, { label: "fail" }],
    });
    expect(getEvaluatorOutputConfigType(categorical!)).toBe("CATEGORICAL");
  });

  it("skips a type this client does not know", () => {
    expect(
      toEvaluatorStoreOutputConfig({ __typename: "%other", name: "x" })
    ).toBeNull();
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
  it("names the good side for the direction and the bounds rule", () => {
    // A score at the threshold is on its high side: good when maximizing,
    // bad when minimizing.
    expect(getContinuousThresholdDescription("MAXIMIZE")).toBe(
      "Good results are at or above this. Must be between the bounds; empty means the midpoint."
    );
    expect(getContinuousThresholdDescription("MINIMIZE")).toBe(
      "Good results are below this. Must be between the bounds; empty means the midpoint."
    );
    expect(getContinuousThresholdDescription("NONE")).toMatch(
      /Must be between the bounds; empty means the midpoint\.$/
    );
  });
});
