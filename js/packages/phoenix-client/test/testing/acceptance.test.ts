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
      "FAIL valid_sql passRate 0.000 (need pass rate >= 1.000; 1 of 1 run)"
    );
    expect(createAcceptanceFailureError([result])?.message).toContain(
      "Acceptance criteria failed:\n  FAIL valid_sql passRate 0.000 (need pass rate >= 1.000; 1 of 1 run)"
    );
  });
  it("reports eligible runs alongside the runs that logged the annotation", () => {
    // 70 runs pass and annotate; 30 runs fail before logging anything (#15425).
    const results = [
      ...Array.from({ length: 70 }, () =>
        createResult([{ name: "correctness", score: 1 }])
      ),
      ...Array.from({ length: 30 }, () => createResult([], "failed")),
    ];

    const [passRate, average] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "correctness",
          metric: "passRate",
          passFn: (annotation) => annotation.score === 1,
          minPassRate: 1,
        },
        { annotationName: "correctness", metric: "average", threshold: 0.95 },
      ],
      results,
    });

    expect(passRate).toMatchObject({
      value: 1,
      sampleCount: 70,
      eligibleRunCount: 100,
      passed: true,
    });
    expect(average).toMatchObject({
      value: 1,
      sampleCount: 70,
      eligibleRunCount: 100,
      passed: true,
    });
    expect(formatAcceptanceResult(passRate)).toBe(
      "PASS correctness passRate 1.000 (need pass rate >= 1.000; 70 of 100 runs)"
    );
  });

  it("shows coverage when one annotated run follows many silent failures", () => {
    const silentFailures = Array.from({ length: 100 }, () =>
      createResult([], "failed")
    );
    const criteria = [
      {
        annotationName: "correctness",
        metric: "passRate" as const,
        passFn: (annotation: Annotation) => annotation.score === 1,
        minPassRate: 1,
      },
    ];

    const [allSilent] = evaluateAcceptanceCriteria({
      criteria,
      results: silentFailures,
    });
    expect(allSilent).toMatchObject({
      value: null,
      sampleCount: 0,
      eligibleRunCount: 100,
      passed: false,
      failureReason: "no matching annotations found",
    });

    const [onePassing] = evaluateAcceptanceCriteria({
      criteria,
      results: [
        ...silentFailures,
        createResult([{ name: "correctness", score: 1 }]),
      ],
    });
    expect(onePassing).toMatchObject({
      value: 1,
      sampleCount: 1,
      eligibleRunCount: 101,
    });
    expect(formatAcceptanceResult(onePassing)).toBe(
      "PASS correctness passRate 1.000 (need pass rate >= 1.000; 1 of 101 runs)"
    );
  });

  it("leaves skipped runs out of the eligible run count", () => {
    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        { annotationName: "quality", metric: "average", threshold: 0.5 },
      ],
      results: [
        createResult([{ name: "quality", score: 1 }]),
        createResult([], "failed"),
        createResult([{ name: "quality", score: 0 }], "skipped"),
      ],
    });

    expect(result).toMatchObject({
      value: 1,
      sampleCount: 1,
      eligibleRunCount: 2,
      passed: true,
    });
  });
});

function createResult(
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
