import { describe, expect, it } from "vitest";

import {
  computePrecisionRecallFScore,
  formatBetaForMetricName,
  getAverageMetricNameSuffix,
} from "../../src/code/classificationMetrics";
import type { PrecisionRecallFScoreOptions } from "../../src/code/classificationMetrics";

describe("computePrecisionRecallFScore", () => {
  it.each<{
    description: string;
    expected: Array<string | number>;
    output: Array<string | number>;
    options: PrecisionRecallFScoreOptions;
    expectedResult: { precision: number; recall: number; fScore: number };
  }>([
    {
      description: "binary ints default positive=1",
      expected: [0, 1, 1, 0, 1],
      output: [0, 1, 0, 0, 1],
      options: { beta: 1 },
      expectedResult: { precision: 1, recall: 2 / 3, fScore: 0.8 },
    },
    {
      description: "binary strings with explicit positive label and beta=0.5",
      expected: ["spam", "ham", "spam", "ham"],
      output: ["spam", "spam", "ham", "ham"],
      options: { beta: 0.5, positiveLabel: "spam" },
      expectedResult: { precision: 0.5, recall: 0.5, fScore: 0.5 },
    },
    {
      description: "multiclass macro averaging (default)",
      expected: ["a", "b", "a", "c"],
      output: ["a", "a", "a", "c"],
      options: { beta: 1, average: "macro" },
      // Per class: a P=2/3 R=1 F1=0.8; b P=0 R=0 F1=0; c P=1 R=1 F1=1
      // -> mean = (0.8 + 0 + 1) / 3 = 0.6
      expectedResult: { precision: 5 / 9, recall: 2 / 3, fScore: 0.6 },
    },
    {
      description: "multiclass micro averaging",
      expected: ["a", "b", "a", "c"],
      output: ["a", "a", "a", "c"],
      options: { beta: 1, average: "micro" },
      expectedResult: { precision: 0.75, recall: 0.75, fScore: 0.75 },
    },
    {
      description: "multiclass weighted averaging",
      expected: ["a", "b", "a", "c"],
      output: ["a", "a", "a", "c"],
      options: { beta: 1, average: "weighted" },
      // Supports a=2, b=1, c=1; per-class F1 0.8, 0, 1
      // -> (0.8*2 + 0*1 + 1*1) / 4 = 0.65
      expectedResult: { precision: 7 / 12, recall: 3 / 4, fScore: 0.65 },
    },
    {
      description: "zero_division set to 1 affects undefined precision",
      expected: ["a", "b"],
      output: ["a", "a"],
      options: { beta: 1, average: "macro", zeroDivision: 1 },
      // class 'a': TP=1, FP=1 -> precision=0.5; class 'b': precision undefined -> 1.0, recall=0.0
      // Macro P=(0.5+1.0)/2=0.75; Macro R=(1.0+0.0)/2=0.5.
      // Per-class F1: a=2*0.5*1/(0.5+1)=2/3; b=0 (recall 0) -> mean=1/3.
      expectedResult: { precision: 0.75, recall: 0.5, fScore: 1 / 3 },
    },
    {
      description: "beta=2 naming and values (micro)",
      expected: ["x", "y", "z"],
      output: ["x", "y", "x"],
      options: { beta: 2, average: "micro" },
      expectedResult: { precision: 2 / 3, recall: 2 / 3, fScore: 2 / 3 },
    },
    {
      description: "multiclass macro F matches sklearn (per-class F averaged)",
      expected: ["cat", "dog", "cat", "bird"],
      output: ["cat", "cat", "cat", "bird"],
      options: { beta: 1, average: "macro" },
      expectedResult: { precision: 5 / 9, recall: 2 / 3, fScore: 0.6 },
    },
    {
      description:
        "multiclass weighted F matches sklearn (support-weighted per-class F)",
      expected: ["cat", "dog", "cat", "bird"],
      output: ["cat", "cat", "cat", "bird"],
      options: { beta: 1, average: "weighted" },
      expectedResult: { precision: 7 / 12, recall: 3 / 4, fScore: 0.65 },
    },
    {
      description: "multiclass macro F-beta (beta=2) matches sklearn",
      expected: ["cat", "dog", "cat", "bird"],
      output: ["cat", "cat", "cat", "bird"],
      options: { beta: 2, average: "macro" },
      // Per-class F2: cat=(5*(2/3)*1)/(4*(2/3)+1)=10/11; dog=0; bird=1
      // -> macro F2=(10/11+0+1)/3=7/11
      expectedResult: { precision: 5 / 9, recall: 2 / 3, fScore: 7 / 11 },
    },
  ])("$description", ({ expected, output, options, expectedResult }) => {
    const result = computePrecisionRecallFScore({ expected, output }, options);
    expect(result.precision).toBeCloseTo(expectedResult.precision, 10);
    expect(result.recall).toBeCloseTo(expectedResult.recall, 10);
    expect(result.fScore).toBeCloseTo(expectedResult.fScore, 10);
  });

  it("defaults to beta=1 and average=macro", () => {
    const result = computePrecisionRecallFScore({
      expected: ["a", "b"],
      output: ["a", "b"],
    });
    expect(result.beta).toBe(1);
    expect(result.average).toBe("macro");
  });

  it("auto-detects the positive label for numeric 0/1 labels", () => {
    const result = computePrecisionRecallFScore({
      expected: [0, 1, 1],
      output: [0, 1, 0],
    });
    expect(result.positiveLabel).toBe(1);
  });

  it("does not auto-detect a positive label for non-binary numeric labels", () => {
    const result = computePrecisionRecallFScore({
      expected: [0, 1, 2],
      output: [0, 1, 2],
    });
    expect(result.positiveLabel).toBeNull();
  });

  it("does not auto-detect a positive label for 0/1 data when a non-macro average is explicitly configured", () => {
    // Regression test: labels are exactly {0,1}, which would trigger binary
    // auto-detection under the default "macro" average, but an explicit
    // non-macro average must be honored instead of silently switching to
    // one-vs-rest binary scoring.
    const expected = [0, 1, 0, 1, 1];
    const output = [1, 1, 0, 0, 1];
    const result = computePrecisionRecallFScore(
      { expected, output },
      { average: "weighted" }
    );
    expect(result.positiveLabel).toBeNull();

    // class 0: TP=1, FP=1, FN=1 -> P=0.5, R=0.5, F1=0.5, support=2
    // class 1: TP=2, FP=1, FN=1 -> P=2/3, R=2/3, F1=2/3, support=3
    // weighted P = (0.5*2 + (2/3)*3) / 5 = 3/5 = 0.6; same for R and F1.
    expect(result.precision).toBeCloseTo(0.6, 10);
    expect(result.recall).toBeCloseTo(0.6, 10);
    expect(result.fScore).toBeCloseTo(0.6, 10);
  });

  it("still honors an explicit positiveLabel even with a non-macro average", () => {
    const result = computePrecisionRecallFScore(
      { expected: [0, 1, 0, 1, 1], output: [1, 1, 0, 0, 1] },
      { average: "weighted", positiveLabel: 1 }
    );
    expect(result.positiveLabel).toBe(1);
    // class 1 one-vs-rest: TP=2, FP=1, FN=1 -> P=R=2/3
    expect(result.precision).toBeCloseTo(2 / 3, 10);
    expect(result.recall).toBeCloseTo(2 / 3, 10);
  });

  it("treats NaN labels as equal to each other instead of always mismatching", () => {
    const result = computePrecisionRecallFScore({
      expected: [NaN, 1],
      output: [NaN, 1],
    });
    expect(result.precision).toBeCloseTo(1, 10);
    expect(result.recall).toBeCloseTo(1, 10);
  });

  it("collects labels in first-seen order across expected then output", () => {
    const result = computePrecisionRecallFScore({
      expected: ["b", "a"],
      output: ["a", "c"],
    });
    expect(result.labels).toEqual(["b", "a", "c"]);
  });

  it("throws when beta is not > 0", () => {
    expect(() =>
      computePrecisionRecallFScore(
        { expected: ["a"], output: ["a"] },
        { beta: 0 }
      )
    ).toThrow(/beta must be > 0/);
  });

  it("throws for an invalid average strategy", () => {
    expect(() =>
      computePrecisionRecallFScore(
        { expected: ["a"], output: ["a"] },
        // @ts-expect-error testing runtime validation of an invalid value
        { average: "invalid" }
      )
    ).toThrow(/average must be one of/);
  });

  it("throws when expected and output lengths differ", () => {
    expect(() =>
      computePrecisionRecallFScore({
        expected: [1, 0, 1],
        output: [1, 0],
      })
    ).toThrow(/same length/);
  });

  it("throws when expected and output are empty", () => {
    expect(() =>
      computePrecisionRecallFScore({ expected: [], output: [] })
    ).toThrow(/non-empty/);
  });

  it("throws when the configured positive label is not present", () => {
    expect(() =>
      computePrecisionRecallFScore(
        { expected: ["a", "a"], output: ["a", "a"] },
        { positiveLabel: "pos" }
      )
    ).toThrow(/not present in labels/);
  });
});

describe("formatBetaForMetricName", () => {
  it.each([
    [1, "f1"],
    [2, "f2"],
    [0.5, "f0_5"],
    [1.5, "f1_5"],
  ])("formats beta=%s as %s", (beta, expectedName) => {
    expect(formatBetaForMetricName(beta)).toBe(expectedName);
  });
});

describe("getAverageMetricNameSuffix", () => {
  it("has no suffix for the default macro average", () => {
    expect(getAverageMetricNameSuffix({})).toBe("");
  });

  it("has a suffix for non-macro averages", () => {
    expect(getAverageMetricNameSuffix({ average: "micro" })).toBe("_micro");
    expect(getAverageMetricNameSuffix({ average: "weighted" })).toBe(
      "_weighted"
    );
  });

  it("has no suffix when a positive label is configured", () => {
    expect(
      getAverageMetricNameSuffix({ average: "micro", positiveLabel: "a" })
    ).toBe("");
  });
});
