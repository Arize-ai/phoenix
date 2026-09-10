import { describe, expect, it } from "vitest";

import {
  createAcceptanceFailureError,
  evaluateAcceptanceCriteria,
  formatAcceptanceResult,
} from "../../src/testing/acceptance";
import type { TestResult } from "../../src/testing/state";
import type { Annotation } from "../../src/testing/types";

describe("acceptance criteria", () => {
  it("computes averages from numeric and boolean annotation scores", () => {
    const results = [
      createResult([{ name: "quality", score: 0.5 }]),
      createResult([{ name: "quality", score: true }]),
      createResult([{ name: "quality", score: 1 }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        { annotationName: "quality", metric: "average", threshold: 0.8 },
      ],
      results,
    });

    expect(result).toMatchObject({
      annotationName: "quality",
      metric: "average",
      threshold: 0.8,
      value: expect.closeTo(0.833, 3),
      sampleCount: 3,
      passed: true,
    });
  });

  it("fails passRate when the fraction passing is below threshold", () => {
    const results = [
      createResult([{ name: "token_f1", score: 0.81 }]),
      createResult([{ name: "token_f1", score: 0.79 }]),
      createResult([{ name: "token_f1", score: 1 }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "token_f1",
          metric: "passRate",
          passFn: (annotation) =>
            typeof annotation.score === "number" && annotation.score >= 0.8,
          minPassRate: 1,
        },
      ],
      results,
    });

    // 0.79 fails the predicate, so 2/3 pass — below the required 100%.
    expect(result).toMatchObject({
      annotationName: "token_f1",
      metric: "passRate",
      minPassRate: 1,
      value: expect.closeTo(0.667, 3),
      sampleCount: 3,
      passed: false,
    });
  });

  it("passes passRate when the fraction passing meets threshold", () => {
    const results = [
      createResult([{ name: "token_f1", score: 0.81 }]),
      createResult([{ name: "token_f1", score: 0.79 }]),
      createResult([{ name: "token_f1", score: 1 }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "token_f1",
          metric: "passRate",
          passFn: (annotation) =>
            typeof annotation.score === "number" && annotation.score >= 0.8,
          minPassRate: 0.6,
        },
      ],
      results,
    });

    // 2/3 = 0.667 clears the required 0.6 pass rate.
    expect(result).toMatchObject({
      value: expect.closeTo(0.667, 3),
      sampleCount: 3,
      passed: true,
    });
  });

  it("evaluates passFn against the full annotation (e.g. label)", () => {
    const results = [
      createResult([{ name: "verdict", label: "correct" }]),
      createResult([{ name: "verdict", label: "correct" }]),
      createResult([{ name: "verdict", label: "wrong" }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "verdict",
          metric: "passRate",
          passFn: (annotation) => annotation.label === "correct",
          minPassRate: 0.6,
        },
      ],
      results,
    });

    // 2/3 runs are labeled "correct", clearing the required 0.6 pass rate.
    expect(result).toMatchObject({
      value: expect.closeTo(0.667, 3),
      sampleCount: 3,
      passed: true,
    });
  });

  it("minimizes: passes when the mean stays at or below threshold", () => {
    const results = [
      createResult([{ name: "latency", score: 0.2 }]),
      createResult([{ name: "latency", score: 0.4 }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "latency",
          metric: "average",
          threshold: 0.5,
          direction: "minimize",
        },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: expect.closeTo(0.3, 3),
      sampleCount: 2,
      passed: true,
    });
  });

  it("uses the last annotation with the same name from each run", () => {
    const results = [
      createResult([
        { name: "quality", score: 0 },
        { name: "quality", score: 1 },
      ]),
      createResult([{ name: "quality", score: 1 }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        { annotationName: "quality", metric: "average", threshold: 1 },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: 1,
      sampleCount: 2,
      passed: true,
    });
  });

  it("fails criteria with no valid scores", () => {
    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        { annotationName: "missing", metric: "average", threshold: 0.8 },
      ],
      results: [
        createResult([{ name: "missing", score: null }]),
        createResult([{ name: "other", score: 1 }]),
      ],
    });

    expect(result).toMatchObject({
      value: null,
      sampleCount: 0,
      passed: false,
      failureReason: "no numeric or boolean scores found",
    });
  });

  it("formats and returns one failure error for failed criteria", () => {
    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "valid_sql",
          metric: "passRate",
          passFn: (annotation) => annotation.score === true,
          minPassRate: 1,
        },
      ],
      results: [createResult([{ name: "valid_sql", score: false }])],
    });

    expect(formatAcceptanceResult(result)).toBe(
      "FAIL valid_sql passRate 0.000 (need pass rate >= 1.000; 1 sample)"
    );
    expect(createAcceptanceFailureError([result])?.message).toContain(
      "Acceptance criteria failed:\n  FAIL valid_sql passRate 0.000 (need pass rate >= 1.000; 1 sample)"
    );
  });

  it("counts runs with no annotation in the passRate denominator", () => {
    const results = [
      ...Array.from({ length: 70 }, () =>
        createRun([{ name: "correctness", score: 1 }])
      ),
      ...Array.from({ length: 30 }, () => createRun([], "failed")),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "correctness",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: 1,
        },
      ],
      results,
    });

    // 70/100 runs pass; the 30 runs that logged no annotation count as
    // non-passing instead of being dropped from the denominator.
    expect(result).toMatchObject({
      value: expect.closeTo(0.7, 3),
      sampleCount: 100,
      passed: false,
    });
  });

  it("counts failed runs with a zero score in the passRate denominator", () => {
    const results = [
      ...Array.from({ length: 70 }, () =>
        createRun([{ name: "correctness", score: 1 }])
      ),
      ...Array.from({ length: 30 }, () =>
        createRun([{ name: "correctness", score: 0 }], "failed")
      ),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "correctness",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: 1,
        },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: expect.closeTo(0.7, 3),
      sampleCount: 100,
      passed: false,
    });
  });

  it("fails passRate when nearly every run logged no annotation", () => {
    const results = [
      ...Array.from({ length: 99 }, () => createRun([], "failed")),
      createRun([{ name: "correctness", score: 1 }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "correctness",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: 1,
        },
      ],
      results,
    });

    // 1/100 passes; the 99 unannotated runs must not vanish from the sample.
    expect(result).toMatchObject({
      value: expect.closeTo(0.01, 3),
      sampleCount: 100,
      passed: false,
    });
  });

  it("fails passRate when no run logged the annotation", () => {
    const results = Array.from({ length: 100 }, () => createRun([], "failed"));

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "correctness",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: 1,
        },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: null,
      sampleCount: 0,
      passed: false,
      failureReason: "no matching annotations found",
    });
  });

  it("counts runs with no annotation as zero in the average", () => {
    const results = [
      ...Array.from({ length: 70 }, () =>
        createRun([{ name: "quality", score: 1 }])
      ),
      ...Array.from({ length: 30 }, () => createRun([], "failed")),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        { annotationName: "quality", metric: "average", threshold: 0.95 },
      ],
      results,
    });

    // (70×1 + 30×0) / 100 = 0.7, which misses the 0.95 bar.
    expect(result).toMatchObject({
      value: expect.closeTo(0.7, 3),
      sampleCount: 100,
      passed: false,
    });
  });

  it("fails average when no run logged a valid score", () => {
    const results = Array.from({ length: 100 }, () => createRun([], "failed"));

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        { annotationName: "quality", metric: "average", threshold: 0.5 },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: null,
      sampleCount: 0,
      passed: false,
      failureReason: "no numeric or boolean scores found",
    });
  });

  it("excludes skipped runs from the denominator", () => {
    const results = [
      ...Array.from({ length: 70 }, () =>
        createRun([{ name: "correctness", score: 1 }])
      ),
      ...Array.from({ length: 30 }, () => createRun([], "skipped")),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "correctness",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: 1,
        },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: 1,
      sampleCount: 70,
      passed: true,
    });
  });

  it("passes when every run annotates and clears the bar", () => {
    const results = Array.from({ length: 100 }, () =>
      createRun([{ name: "correctness", score: 1 }])
    );

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "correctness",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: 1,
        },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: 1,
      sampleCount: 100,
      passed: true,
    });
  });
});

function createResult(annotations: Annotation[]): TestResult {
  return {
    suiteName: "acceptance suite",
    testName: "case",
    status: "passed",
    annotations,
    durationMs: 1,
  };
}

function createRun(
  annotations: Annotation[],
  status: TestResult["status"] = "passed"
): TestResult {
  return {
    suiteName: "acceptance suite",
    testName: "case",
    status,
    annotations,
    durationMs: 1,
  };
}
