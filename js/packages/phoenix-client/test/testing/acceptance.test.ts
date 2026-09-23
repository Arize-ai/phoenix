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
      createResult({ annotations: [{ name: "quality", score: 0.5 }] }),
      createResult({ annotations: [{ name: "quality", score: true }] }),
      createResult({ annotations: [{ name: "quality", score: 1 }] }),
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
      createResult({ annotations: [{ name: "token_f1", score: 0.81 }] }),
      createResult({ annotations: [{ name: "token_f1", score: 0.79 }] }),
      createResult({ annotations: [{ name: "token_f1", score: 1 }] }),
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
      createResult({ annotations: [{ name: "token_f1", score: 0.81 }] }),
      createResult({ annotations: [{ name: "token_f1", score: 0.79 }] }),
      createResult({ annotations: [{ name: "token_f1", score: 1 }] }),
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
      createResult({ annotations: [{ name: "verdict", label: "correct" }] }),
      createResult({ annotations: [{ name: "verdict", label: "correct" }] }),
      createResult({ annotations: [{ name: "verdict", label: "wrong" }] }),
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
      createResult({ annotations: [{ name: "latency", score: 0.2 }] }),
      createResult({ annotations: [{ name: "latency", score: 0.4 }] }),
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
      createResult({
        annotations: [
          { name: "quality", score: 0 },
          { name: "quality", score: 1 },
        ],
      }),
      createResult({ annotations: [{ name: "quality", score: 1 }] }),
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
        createResult({ annotations: [{ name: "missing", score: null }] }),
        createResult({ annotations: [{ name: "other", score: 1 }] }),
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
      results: [
        createResult({ annotations: [{ name: "valid_sql", score: false }] }),
      ],
    });

    expect(formatAcceptanceResult(result)).toBe(
      "FAIL valid_sql passRate 0.000 (need pass rate >= 1.000; 1 of 1 run)"
    );
    expect(createAcceptanceFailureError([result])?.message).toContain(
      "Acceptance criteria failed:\n  FAIL valid_sql passRate 0.000 (need pass rate >= 1.000; 1 of 1 run)"
    );
  });

  it("excludes runs that log a different annotation from passRate", () => {
    // A suite may gate `correctness` on some tests and log other annotations
    // on the rest; those runs are outside the criterion, not failures.
    const results = [
      ...Array.from({ length: 70 }, () =>
        createResult({ annotations: [{ name: "correctness", score: 1 }] })
      ),
      ...Array.from({ length: 30 }, () =>
        createResult({ annotations: [{ name: "refusal", score: 1 }] })
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
      value: 1,
      sampleCount: 70,
      eligibleRunCount: 100,
      passed: true,
    });
  });

  it("leaves errored runs without the annotation to the test framework", () => {
    // Runs that throw are already failed Vitest / Jest tests; they widen the
    // eligible-run count but are not counted against the criterion again.
    const results = [
      ...Array.from({ length: 70 }, () =>
        createResult({ annotations: [{ name: "correctness", score: 1 }] })
      ),
      ...Array.from({ length: 30 }, () =>
        createResult({ annotations: [], status: "failed" })
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
      value: 1,
      sampleCount: 70,
      eligibleRunCount: 100,
      passed: true,
    });
  });

  it("counts failed runs that logged the annotation in passRate", () => {
    const results = [
      ...Array.from({ length: 70 }, () =>
        createResult({ annotations: [{ name: "correctness", score: 1 }] })
      ),
      ...Array.from({ length: 30 }, () =>
        createResult({
          annotations: [{ name: "correctness", score: 0 }],
          status: "failed",
        })
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
      eligibleRunCount: 100,
      passed: false,
    });
  });

  it("fails passRate when no run logged the annotation", () => {
    const results = Array.from({ length: 100 }, () =>
      createResult({ annotations: [], status: "failed" })
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
      value: null,
      sampleCount: 0,
      eligibleRunCount: 100,
      passed: false,
      failureReason: "no matching annotations found",
    });
  });

  it("does not impute a score for runs missing from a minimize average", () => {
    const results = [
      ...Array.from({ length: 10 }, () =>
        createResult({ annotations: [{ name: "latency", score: 5 }] })
      ),
      ...Array.from({ length: 90 }, () =>
        createResult({ annotations: [], status: "failed" })
      ),
    ];

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        {
          annotationName: "latency",
          metric: "average",
          threshold: 1,
          direction: "minimize",
        },
      ],
      results,
    });

    // Imputing 0 for the 90 unannotated runs would report a passing mean of 0.5.
    expect(result).toMatchObject({
      value: 5,
      sampleCount: 10,
      eligibleRunCount: 100,
      passed: false,
    });
  });

  it("fails average when no run logged a valid score", () => {
    const results = Array.from({ length: 100 }, () =>
      createResult({ annotations: [], status: "failed" })
    );

    const [result] = evaluateAcceptanceCriteria({
      criteria: [
        { annotationName: "quality", metric: "average", threshold: 0.5 },
      ],
      results,
    });

    expect(result).toMatchObject({
      value: null,
      sampleCount: 0,
      eligibleRunCount: 100,
      passed: false,
      failureReason: "no numeric or boolean scores found",
    });
  });

  it("excludes skipped runs from the eligible-run count", () => {
    const results = [
      ...Array.from({ length: 70 }, () =>
        createResult({ annotations: [{ name: "correctness", score: 1 }] })
      ),
      ...Array.from({ length: 30 }, () =>
        createResult({ annotations: [], status: "skipped" })
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
      value: 1,
      sampleCount: 70,
      eligibleRunCount: 70,
      passed: true,
    });
  });

  it("formats coverage as annotated runs out of eligible runs", () => {
    const results = [
      ...Array.from({ length: 70 }, () =>
        createResult({ annotations: [{ name: "correctness", score: 1 }] })
      ),
      ...Array.from({ length: 30 }, () => createResult({ annotations: [] })),
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

    expect(formatAcceptanceResult(result!)).toBe(
      "PASS correctness passRate 1.000 (need pass rate >= 1.000; 70 of 100 runs)"
    );
  });
});

function createResult({
  annotations,
  status = "passed",
}: {
  annotations: Annotation[];
  status?: TestResult["status"];
}): TestResult {
  return {
    suiteName: "acceptance suite",
    testName: "case",
    status,
    annotations,
    durationMs: 1,
  };
}
