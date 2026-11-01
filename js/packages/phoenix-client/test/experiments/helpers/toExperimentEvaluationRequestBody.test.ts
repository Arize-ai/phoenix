import { describe, expect, it } from "vitest";

import { toExperimentEvaluationRequestBody } from "../../../src/experiments/helpers/toExperimentEvaluationRequestBody";
import type { EvaluationResult } from "../../../src/types/experiments";

const startTime = new Date("2026-01-01T00:00:00.000Z");
const endTime = new Date("2026-01-01T00:00:01.000Z");

describe("toExperimentEvaluationRequestBody", () => {
  it("moves metadata to the top level and keeps only result fields under result", () => {
    // Evaluators can return keys beyond the declared type at runtime.
    const result = {
      score: 0.5,
      label: "partial",
      explanation: "half right",
      metadata: { judge: "v1" },
      name: "ignored",
    } as EvaluationResult;

    expect(
      toExperimentEvaluationRequestBody({
        experimentRunId: "run-1",
        name: "correctness",
        annotatorKind: "LLM",
        startTime,
        endTime,
        result,
        error: null,
        traceId: "trace-1",
      })
    ).toStrictEqual({
      experiment_run_id: "run-1",
      name: "correctness",
      annotator_kind: "LLM",
      start_time: "2026-01-01T00:00:00.000Z",
      end_time: "2026-01-01T00:00:01.000Z",
      result: { score: 0.5, label: "partial", explanation: "half right" },
      metadata: { judge: "v1" },
      error: null,
      trace_id: "trace-1",
    });
  });

  it("sends a null result and metadata for an errored evaluation", () => {
    const body = toExperimentEvaluationRequestBody({
      experimentRunId: "run-1",
      name: "correctness",
      annotatorKind: "CODE",
      startTime,
      endTime,
      result: null,
      error: "boom",
      traceId: null,
    });
    expect(body.result).toBeNull();
    expect(body.metadata).toBeNull();
    expect(body.error).toBe("boom");
  });
});
