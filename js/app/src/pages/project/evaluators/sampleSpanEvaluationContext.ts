import { getEvaluatorBoundVariableNames } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * Mirrors the server's `span_eval_context()`: `input` and `output` are the
 * span's own values, and `metadata` carries the span filter language's names
 * flat beside the whole span record under `metadata.span`.
 */
export type SampleSpanEvaluationContext = {
  /** OpenInference span kind (e.g. "LLM"). */
  spanKind: string;
  context: EvaluatorMappingSource<"span">;
};

const LLM_INPUT_MESSAGES = [
  {
    role: "system",
    content: "You are a concise support assistant for Acme Cloud.",
  },
  {
    role: "user",
    content: "How do I rotate my API key without downtime?",
  },
];

const LLM_INPUT_VALUE = JSON.stringify({ messages: LLM_INPUT_MESSAGES });

const LLM_OUTPUT_TEXT =
  "Create a second key under Settings → API Keys, deploy it to your " +
  "services, then revoke the old key once traffic drains. Both keys stay " +
  "active during the overlap, so there is no downtime.";

const LLM_ATTRIBUTES = {
  openinference: { span: { kind: "LLM" } },
  llm: {
    provider: "openai",
    model_name: "gpt-4o-mini",
    input_messages: LLM_INPUT_MESSAGES.map((message) => ({ message })),
    output_messages: [
      { message: { role: "assistant", content: LLM_OUTPUT_TEXT } },
    ],
    token_count: { prompt: 42, completion: 58, total: 100 },
  },
  input: {
    value: LLM_INPUT_VALUE,
    mime_type: "application/json",
  },
  output: { value: LLM_OUTPUT_TEXT, mime_type: "text/plain" },
};

/** The span's own names, exactly as the span filter language spells them. */
const LLM_SPAN_VOCABULARY: Record<string, unknown> = {
  span_id: "7f3b1c9a2d5e4081",
  trace_id: "4a1e6d0c9b8f47a2b3c5d7e9f1a2b3c4",
  parent_id: null,
  name: "ChatCompletion",
  span_kind: "LLM",
  status_code: "OK",
  status_message: "",
  latency_ms: 842.5,
  cumulative_llm_token_count_prompt: 42,
  cumulative_llm_token_count_completion: 58,
  cumulative_llm_token_count_total: 100,
};

const LLM_SPAN_DOCUMENT: Record<string, unknown> = {
  ...LLM_SPAN_VOCABULARY,
  start_time: "2026-01-14T18:22:04.118000+00:00",
  end_time: "2026-01-14T18:22:04.960500+00:00",
  input_value: LLM_INPUT_VALUE,
  output_value: LLM_OUTPUT_TEXT,
  attributes: LLM_ATTRIBUTES,
  events: [],
};

const LLM_SAMPLE: SampleSpanEvaluationContext = {
  spanKind: "LLM",
  context: {
    input: LLM_INPUT_VALUE,
    output: LLM_OUTPUT_TEXT,
    metadata: { ...LLM_SPAN_VOCABULARY, span: LLM_SPAN_DOCUMENT },
  },
};

/**
 * The span a scope with no matching records is previewed against.
 *
 * `_filterCondition` is what the scope selects on; the one sample stands in for
 * every kind of span it could pick, so nothing reads it yet.
 */
export function getSampleSpanEvaluationContext(
  _filterCondition: string
): SampleSpanEvaluationContext {
  return LLM_SAMPLE;
}

/** A grain's shape with no values: what exists, never what it holds. */
export type GenericEvaluationContext<
  TGrain extends "span" | "session" = "span" | "session",
> = {
  context: EvaluatorMappingSource<TGrain>;
};

/**
 * The span's standard fields with no values. The completion popup and the
 * bindings list build from this skeleton rather than from the sample above, so
 * authoring vocabulary is the schema itself and cannot drift with invented
 * data; the sample exists only as a runnable demo record.
 */
const GENERIC_SPAN_DOCUMENT: Record<string, unknown> = {
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

const GENERIC_SPAN_CONTEXT: GenericEvaluationContext<"span"> = {
  context: {
    input: null,
    output: null,
    metadata: {
      ...Object.fromEntries(
        [...getEvaluatorBoundVariableNames("span")].map((name) => [name, null])
      ),
      span: GENERIC_SPAN_DOCUMENT,
    },
  },
};

export function getGenericSpanEvaluationContext(): GenericEvaluationContext<"span"> {
  return GENERIC_SPAN_CONTEXT;
}
