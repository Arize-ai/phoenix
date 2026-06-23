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

  it("computes pass rates with a numeric passing score", () => {
    const results = [
      createResult([{ name: "token_f1", score: 0.81 }]),
      createResult([{ name: "token_f1", score: 0.79 }]),
      createResult([{ name: "token_f1", score: 1 }]),
      createResult([{ name: "token_f1", score: null }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "token_f1",
          metric: "passRate",
          threshold: 0.6,
          passingScore: 0.8,
        },
      ],
      results,
    });

    expect(result).toMatchObject({
      annotationName: "token_f1",
      metric: "passRate",
      threshold: 0.6,
      passingScore: 0.8,
      value: expect.closeTo(0.667, 3),
      sampleCount: 3,
      passed: true,
    });
  });

  it("computes pass rates from boolean scores", () => {
    const results = [
      createResult([{ name: "valid_sql", score: true }]),
      createResult([{ name: "valid_sql", score: true }]),
      createResult([{ name: "valid_sql", score: false }]),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        { annotationName: "valid_sql", metric: "passRate", threshold: 0.8 },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: expect.closeTo(0.667, 3),
      sampleCount: 3,
      passed: false,
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
        { annotationName: "valid_sql", metric: "passRate", threshold: 0.8 },
      ],
      results: [createResult([{ name: "valid_sql", score: false }])],
    });

    expect(formatAcceptanceResult(result)).toBe(
      "FAIL valid_sql passRate 0.000 < 0.800 (1 sample)"
    );
    expect(createAcceptanceFailureError([result])?.message).toContain(
      "Acceptance criteria failed:\n  FAIL valid_sql passRate 0.000 < 0.800 (1 sample)"
    );
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
