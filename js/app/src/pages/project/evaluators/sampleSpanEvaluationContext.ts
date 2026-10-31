import type { EvaluatorMappingSource } from "@phoenix/types";

/** Mirrors the server's `span_eval_context()`. */
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

const LLM_USER_METADATA = { environment: "production" };

const LLM_ATTRIBUTES = {
  openinference: { span: { kind: "LLM" } },
  metadata: LLM_USER_METADATA,
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

const LLM_ANNOTATIONS = {
  correctness: [
    {
      label: "correct",
      score: 1.0,
      explanation: "The steps match the documented key-rotation flow.",
      metadata: {},
      annotator_kind: "LLM",
      user_id: null,
      username: null,
      email: null,
    },
  ],
};

const LLM_SAMPLE: SampleSpanEvaluationContext = {
  spanKind: "LLM",
  context: {
    input: { messages: LLM_INPUT_MESSAGES },
    output: { messages: [{ role: "assistant", content: LLM_OUTPUT_TEXT }] },
    metadata: {
      ...LLM_USER_METADATA,
      ...LLM_SPAN_VOCABULARY,
      start_time: "2026-01-14T18:22:04.118000+00:00",
      end_time: "2026-01-14T18:22:04.960500+00:00",
      attributes: LLM_ATTRIBUTES,
      events: [],
      annotations: LLM_ANNOTATIONS,
    },
  },
};

/** The span a scope with no matching records is previewed against. */
export function getSampleSpanEvaluationContext(): SampleSpanEvaluationContext {
  return LLM_SAMPLE;
}
