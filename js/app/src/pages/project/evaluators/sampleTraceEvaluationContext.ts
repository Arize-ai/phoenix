import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * Mirrors the server's `trace_eval_context()`. The first trace of the sample session, so
 * the three grains' samples read as one product.
 */
export type SampleTraceEvaluationContext = {
  context: EvaluatorMappingSource<"trace">;
};

const ROOT_INPUT = "My deploy is stuck on the migration step. Can you help?";

const ROOT_OUTPUT =
  "It looks like the migration is waiting on a lock. Let's check which " +
  "query is holding it.";

/** The root span's attributes, which a trace context carries whole. */
const ROOT_ATTRIBUTES = {
  openinference: { span: { kind: "AGENT" } },
  metadata: { environment: "production" },
  input: { value: ROOT_INPUT, mime_type: "text/plain" },
  output: { value: ROOT_OUTPUT, mime_type: "text/plain" },
};

/** The trace's own names, exactly as the trace filter language spells them. */
const TRACE_VOCABULARY: Record<string, unknown> = {
  trace_id: "4a1e6d0c9b8f47a2b3c5d7e9f1a2b3c4",
  latency_ms: 3500.0,
  num_spans: 6,
  error_count: 0,
  llm_span_count: 2,
  tool_span_count: 1,
  token_count_prompt: 1024,
  token_count_completion: 148,
  token_count_total: 1172,
  prompt_cost: 0.0026,
  completion_cost: 0.0009,
  total_cost: 0.0035,
};

const TRACE_ANNOTATIONS = {
  helpfulness: [
    {
      label: "helpful",
      score: 1.0,
      explanation: "The reply names the next diagnostic step.",
      metadata: {},
      annotator_kind: "LLM",
    },
  ],
};

const TRACE_SAMPLE: SampleTraceEvaluationContext = {
  context: {
    input: ROOT_INPUT,
    output: ROOT_OUTPUT,
    metadata: {
      ...TRACE_VOCABULARY,
      start_time: "2026-01-14T18:20:11.402000+00:00",
      end_time: "2026-01-14T18:20:14.902000+00:00",
      attributes: ROOT_ATTRIBUTES,
      events: [],
      trace_annotations: TRACE_ANNOTATIONS,
    },
  },
};

/** The trace a scope with no matching records is previewed against. */
export function getSampleTraceEvaluationContext(): SampleTraceEvaluationContext {
  return TRACE_SAMPLE;
}
