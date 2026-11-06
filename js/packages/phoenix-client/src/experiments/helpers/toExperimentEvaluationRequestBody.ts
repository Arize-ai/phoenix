import type { components } from "../../__generated__/api/v1";
import type { AnnotatorKind } from "../../types/annotations";
import type { EvaluationResult } from "../../types/experiments";

type UpsertExperimentEvaluationRequestBody =
  components["schemas"]["UpsertExperimentEvaluationRequestBody"];

/**
 * Build the body for `POST /v1/experiment_evaluations`.
 *
 * The endpoint reads `metadata` from the top level of the body and ignores any
 * other key under `result`. `client.POST` infers its body type, so TypeScript
 * does not flag unknown keys there; copying each field explicitly into a value
 * of the declared request type here restores that check. Do not spread
 * evaluator output into the body.
 */
export function toExperimentEvaluationRequestBody({
  experimentRunId,
  name,
  annotatorKind,
  startTime,
  endTime,
  result,
  error,
  traceId,
}: {
  readonly experimentRunId: string;
  readonly name: string;
  readonly annotatorKind: AnnotatorKind;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly result: EvaluationResult | null;
  readonly error: string | null;
  readonly traceId: string | null;
}): UpsertExperimentEvaluationRequestBody {
  return {
    experiment_run_id: experimentRunId,
    name,
    annotator_kind: annotatorKind,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    result: result
      ? {
          score: result.score ?? null,
          label: result.label ?? null,
          explanation: result.explanation ?? null,
        }
      : null,
    metadata: result?.metadata ?? null,
    error,
    trace_id: traceId,
  };
}
