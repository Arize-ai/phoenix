/**
 * A natural-language request paired with the span filter expressions
 * accepted as correct translations. The first accepted expression is the
 * canonical answer; the rest are alternative phrasings that filter the
 * same spans (clause order, equivalent fields). Anything else falls
 * through to the LLM equivalence judge.
 */
export type SpanFilterEvalCase = {
  /** Stable example id — keeps experiment runs upserting onto the same dataset example. */
  id: string;
  /** The natural-language request a user would type. */
  query: string;
  /** Expressions accepted as (normalized) exact matches. */
  accepted: string[];
};

/**
 * The prompt's behaviors under test, one per case: enum casing, unit
 * conversion, the substring idiom, subscript access, boolean composition,
 * and the root-span idiom. Grow this set from real misses observed in the
 * field rather than hypotheticals.
 */
export const spanFilterCases: SpanFilterEvalCase[] = [
  {
    id: "errors",
    query: "spans that errored",
    accepted: ["status_code == 'ERROR'"],
  },
  {
    id: "span-kind",
    query: "show me LLM spans",
    accepted: ["span_kind == 'LLM'"],
  },
  {
    id: "latency-seconds",
    query: "spans slower than 5 seconds",
    accepted: ["latency_ms > 5000", "latency_ms >= 5000"],
  },
  {
    id: "root-spans",
    query: "only root spans",
    accepted: ["parent_id is None", "parent_span is None"],
  },
  {
    id: "input-substring",
    query: "spans where the input mentions a refund",
    accepted: ["'refund' in input.value"],
  },
  {
    id: "llm-provider",
    query: "spans where the llm provider is openai",
    accepted: ["attributes['llm']['provider'] == 'openai'"],
  },
  {
    id: "span-name",
    query: "spans named ChatCompletion",
    accepted: ["name == 'ChatCompletion'"],
  },
  {
    id: "kind-and-status",
    query: "LLM spans that errored",
    accepted: [
      "span_kind == 'LLM' and status_code == 'ERROR'",
      "status_code == 'ERROR' and span_kind == 'LLM'",
    ],
  },
  {
    id: "negation",
    query: "spans that did not error",
    accepted: [
      "status_code != 'ERROR'",
      "not status_code == 'ERROR'",
      "not (status_code == 'ERROR')",
    ],
  },
  {
    id: "annotation-score",
    query: "spans with a correctness score of at least 0.8",
    accepted: [
      "annotations['correctness'].score >= 0.8",
      "evals['correctness'].score >= 0.8",
    ],
  },
  {
    id: "annotation-label",
    query: "spans labeled hallucinated by the Hallucination eval",
    accepted: [
      "annotations['Hallucination'].label == 'hallucinated'",
      "evals['Hallucination'].label == 'hallucinated'",
    ],
  },
  {
    id: "metadata-key",
    query: "spans where the metadata topic is billing",
    accepted: ["metadata['topic'] == 'billing'"],
  },
  {
    id: "token-count",
    query: "spans that used more than 1000 tokens in total",
    accepted: [
      "cumulative_token_count.total > 1000",
      "llm.token_count.total > 1000",
    ],
  },
  {
    id: "trace-id",
    query: "spans in trace abc123",
    accepted: ["trace_id == 'abc123'"],
  },
  {
    id: "model-name",
    query: "spans that used the model gpt-4",
    accepted: [
      "llm.model_name == 'gpt-4'",
      "attributes['llm']['model_name'] == 'gpt-4'",
    ],
  },
  {
    id: "kind-disjunction",
    query: "tool or retriever spans",
    accepted: [
      "span_kind == 'TOOL' or span_kind == 'RETRIEVER'",
      "span_kind == 'RETRIEVER' or span_kind == 'TOOL'",
    ],
  },
  {
    id: "output-substring",
    query: "spans whose output contains the word 'apology'",
    accepted: ["'apology' in output.value"],
  },
  {
    id: "slow-roots",
    query: "root spans that took over 10 seconds",
    accepted: [
      "parent_id is None and latency_ms > 10000",
      "latency_ms > 10000 and parent_id is None",
      "parent_span is None and latency_ms > 10000",
      "latency_ms > 10000 and parent_span is None",
    ],
  },
];
