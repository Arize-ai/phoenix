import { describe, expect, it } from "vitest";

import type { ExampleRunData } from "@phoenix/pages/playground/PlaygroundDatasetExamplesTableContext";

import {
  getEvaluatorCellResult,
  getEvaluatorTaskAnnotation,
  getExpectedOutput,
  summarizeExpectedAgreement,
} from "../evaluatorCellResults";

const PASS_FAIL = {
  name: "result",
  optimizationDirection: "MAXIMIZE" as const,
  values: [
    { label: "pass", score: 1 },
    { label: "fail", score: 0 },
  ],
};

function evaluation(
  evaluatorName: string,
  fields: {
    label?: string | null;
    score?: number | null;
    error?: string | null;
    trace?: { traceId: string; projectId: string } | null;
  }
): NonNullable<ExampleRunData["evaluations"]>[number] {
  return {
    __typename: "EvaluationChunk",
    experimentId: "exp-1",
    datasetExampleId: "example-1",
    repetitionNumber: 1,
    evaluatorName,
    experimentRunEvaluation:
      fields.error != null
        ? null
        : {
            id: "annotation-1",
            name: evaluatorName,
            label: fields.label ?? null,
            score: fields.score ?? null,
            annotatorKind: "CODE",
            explanation: null,
            metadata: {},
            startTime: "2026-09-14T00:00:00Z",
          },
    trace: fields.trace ?? null,
    error: fields.error ?? null,
  };
}

describe("getEvaluatorTaskAnnotation", () => {
  it("names a single output after the evaluator and a multi-output one after both", () => {
    expect(
      getEvaluatorTaskAnnotation({
        evaluator: { name: "no_sql", outputConfigs: [PASS_FAIL] },
        position: 0,
      })
    ).toEqual({
      name: "no_sql",
      output: {
        name: "result",
        labels: ["pass", "fail"],
        labelScores: { pass: 1, fail: 0 },
        lowerBound: null,
        upperBound: null,
      },
    });
    expect(
      getEvaluatorTaskAnnotation({
        evaluator: {
          name: "judge",
          outputConfigs: [
            PASS_FAIL,
            {
              name: "confidence",
              optimizationDirection: "MAXIMIZE",
              lowerBound: 0,
              upperBound: 1,
            },
          ],
        },
        position: 0,
      }).name
    ).toBe("judge.result");
  });

  it("names an unnamed draft by its column and has no output without a config", () => {
    expect(
      getEvaluatorTaskAnnotation({
        evaluator: { name: "  ", outputConfigs: [] },
        position: 2,
      })
    ).toEqual({ name: "evaluator_3", output: undefined });
  });
});

describe("getEvaluatorCellResult", () => {
  it("reads the verdict off the chunk named after the annotation", () => {
    const runData: ExampleRunData = {
      evaluations: [
        evaluation("other", { label: "fail", score: 0 }),
        evaluation("no_sql", {
          label: "pass",
          score: 1,
          trace: { traceId: "t1", projectId: "p1" },
        }),
      ],
    };

    expect(
      getEvaluatorCellResult({ runData, annotationName: "no_sql" })
    ).toEqual({
      prediction: {
        status: "success",
        label: "pass",
        score: 1,
        explanation: null,
      },
      trace: { traceId: "t1", projectId: "p1" },
    });
  });

  it("falls back to the run's chunk when the task was renamed since", () => {
    const runData: ExampleRunData = {
      evaluations: [evaluation("old_name", { label: "pass", score: 1 })],
    };

    expect(
      getEvaluatorCellResult({ runData, annotationName: "new_name" })
        ?.prediction
    ).toMatchObject({ status: "success", label: "pass" });
  });

  it("reports an errored evaluation, then a failed run, and nothing before either", () => {
    expect(
      getEvaluatorCellResult({
        runData: { evaluations: [evaluation("no_sql", { error: "boom" })] },
        annotationName: "no_sql",
      })
    ).toEqual({ prediction: { status: "error", error: "boom" }, trace: null });
    expect(
      getEvaluatorCellResult({
        runData: { errorMessage: "sandbox unavailable" },
        annotationName: "no_sql",
      })
    ).toEqual({
      prediction: { status: "error", error: "sandbox unavailable" },
      trace: null,
    });
    expect(
      getEvaluatorCellResult({
        runData: { experimentRunId: "run-1" },
        annotationName: "no_sql",
      })
    ).toBeNull();
    expect(
      getEvaluatorCellResult({ runData: undefined, annotationName: "no_sql" })
    ).toBeNull();
  });
});

describe("getExpectedOutput", () => {
  const expectedOutputs = [
    { annotationName: "no_sql", label: "pass", score: 1, explanation: null },
  ];

  it("shows a queued annotation over the stored one, and a queued clear as nothing", () => {
    expect(
      getExpectedOutput({
        pending: { no_sql: { label: "fail", score: 0 } },
        expectedOutputs,
        annotationName: "no_sql",
      })
    ).toEqual({ label: "fail", score: 0 });
    expect(
      getExpectedOutput({
        pending: { no_sql: null },
        expectedOutputs,
        annotationName: "no_sql",
      })
    ).toBeUndefined();
  });

  it("falls back to the dataset's label for the annotation, or nothing", () => {
    expect(
      getExpectedOutput({
        pending: { other: { label: "x" } },
        expectedOutputs,
        annotationName: "no_sql",
      })
    ).toEqual({ label: "pass", score: 1, explanation: null });
    expect(
      getExpectedOutput({
        pending: undefined,
        expectedOutputs,
        annotationName: "missing",
      })
    ).toBeUndefined();
  });
});

describe("summarizeExpectedAgreement", () => {
  it("counts expectations, the comparable ones, and the matches over the first repetition", () => {
    const output = {
      name: "result",
      labels: ["pass", "fail"],
      labelScores: { pass: 1, fail: 0 },
      lowerBound: null,
      upperBound: null,
    };

    const examples = [
      {
        id: "e1",
        expectedOutputs: [
          {
            annotationName: "no_sql",
            label: "pass",
            score: 1,
            explanation: null,
          },
        ],
      },
      {
        id: "e2",
        expectedOutputs: [
          {
            annotationName: "no_sql",
            label: "fail",
            score: 0,
            explanation: null,
          },
        ],
      },
      {
        // An expectation the config cannot produce is counted, not compared.
        id: "e3",
        expectedOutputs: [
          {
            annotationName: "no_sql",
            label: "maybe",
            score: null,
            explanation: null,
          },
        ],
      },
      { id: "e4", expectedOutputs: [] },
    ];

    const responses = {
      e1: {
        1: { evaluations: [evaluation("no_sql", { label: "pass", score: 1 })] },
      },
      e2: {
        1: { evaluations: [evaluation("no_sql", { label: "pass", score: 1 })] },
      },
      e3: {
        1: { evaluations: [evaluation("no_sql", { label: "pass", score: 1 })] },
      },
    };

    expect(
      summarizeExpectedAgreement({
        examples,
        responses,
        pendingExpectedOutputs: { e4: { no_sql: { label: "pass", score: 1 } } },
        annotationName: "no_sql",
        output,
      })
    ).toEqual({ withExpected: 4, comparable: 3, matches: 1 });
  });
});
