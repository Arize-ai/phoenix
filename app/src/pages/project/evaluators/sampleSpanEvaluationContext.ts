import type { EvaluatorMappingSource } from "@phoenix/types";

/**
 * A sample span evaluation context shown when no project spans match the
 * evaluator's scope, so the authoring loop (mapping source, binding
 * diagnostics, and test runs) works before any matching traffic arrives.
 *
 * The shape mirrors the server's `span_eval_context()` exactly — `input` and
 * `output` are the raw `input.value`/`output.value` attribute values, and
 * `metadata.attributes` roots the OpenInference attribute tree — so paths
 * authored against the sample resolve the same way against real spans.
 */
export type SampleSpanEvaluationContext = {
  /** OpenInference span kind the sample represents (e.g. "LLM"). */
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

const LLM_OUTPUT_TEXT =
  "Create a second key under Settings → API Keys, deploy it to your " +
  "services, then revoke the old key once traffic drains. Both keys stay " +
  "active during the overlap, so there is no downtime.";

const LLM_SAMPLE: SampleSpanEvaluationContext = {
  spanKind: "LLM",
  context: {
    // Instrumentors record `input.value` for LLM spans as the serialized
    // request payload, so the sample keeps it a JSON string — drilling into
    // structured data happens through `metadata.attributes.llm.*`.
    input: JSON.stringify({ messages: LLM_INPUT_MESSAGES }),
    output: LLM_OUTPUT_TEXT,
    metadata: {
      attributes: {
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
          value: JSON.stringify({ messages: LLM_INPUT_MESSAGES }),
          mime_type: "application/json",
        },
        output: { value: LLM_OUTPUT_TEXT, mime_type: "text/plain" },
      },
      name: "ChatCompletion",
      span_kind: "LLM",
      status_code: "OK",
      status_message: "",
    },
  },
};

/**
 * Samples keyed by OpenInference span kind. LLM is the only kind shipped so
 * far and doubles as the fallback; add kinds here (RETRIEVER, TOOL, ...) to
 * make filter-targeted samples more representative.
 */
const SAMPLES_BY_SPAN_KIND: Record<string, SampleSpanEvaluationContext> = {
  LLM: LLM_SAMPLE,
};

const SPAN_KIND_FILTER_PATTERN = /span_kind\s*==\s*['"]([A-Za-z_]+)['"]/;

/**
 * Picks the sample that best matches the evaluator's span filter: the kind
 * named by a `span_kind == '...'` condition when a sample for it exists,
 * otherwise the LLM sample.
 */
export function getSampleSpanEvaluationContext(
  filterCondition: string
): SampleSpanEvaluationContext {
  const spanKind = filterCondition.match(SPAN_KIND_FILTER_PATTERN)?.[1];
  return (spanKind && SAMPLES_BY_SPAN_KIND[spanKind]) || LLM_SAMPLE;
}
