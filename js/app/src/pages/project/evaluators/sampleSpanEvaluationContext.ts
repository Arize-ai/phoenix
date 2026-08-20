import { getEvaluatorBoundVariableNames } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * The span's standard fields with no values, for a project whose scope matches
 * no spans yet. Authoring needs the record's shape — which paths exist, which
 * names bind — and inventing values would only dress the shape up as data, so
 * every field is null until a real span supplies the values.
 *
 * Mirrors the entity `span_eval_context()` builds: `input` and `span` hold the
 * same document, `output` is the span's raw output value.
 */
export type SampleSpanEvaluationContext = {
  context: EvaluatorMappingSource<"span">;
  /** The names a span supplies, matching `evaluationBoundVariables`. */
  boundVariables: Record<string, unknown>;
};

const SPAN_DOCUMENT: Record<string, unknown> = {
  span_id: null,
  trace_id: null,
  parent_id: null,
  name: null,
  span_kind: null,
  status_code: null,
  status_message: null,
  latency_ms: null,
  start_time: null,
  end_time: null,
  cumulative_llm_token_count_prompt: null,
  cumulative_llm_token_count_completion: null,
  cumulative_llm_token_count_total: null,
  input_value: null,
  output_value: null,
  attributes: {},
  events: [],
};

const SPAN_SAMPLE: SampleSpanEvaluationContext = {
  context: {
    // `input` and `span` hold the same document, exactly as the server
    // builds the context.
    input: SPAN_DOCUMENT,
    output: null,
    span: SPAN_DOCUMENT,
  },
  boundVariables: Object.fromEntries(
    [...getEvaluatorBoundVariableNames("span")].map((name) => [name, null])
  ),
};

export function getSampleSpanEvaluationContext(): SampleSpanEvaluationContext {
  return SPAN_SAMPLE;
}
