import type { Completion } from "@codemirror/autocomplete";

import { createAIQueryDSL } from "@phoenix/components/filter/ai/createAIQueryDSL";
import type { DSLFilterSnippet } from "@phoenix/components/filter/DSLFilterConditionField";

import {
  ORPHAN_AWARE_ROOT_SPANS_CONDITION,
  STRICT_ROOT_SPANS_CONDITION,
} from "./spanFilterRootScopeConstants";

/**
 * The span filter DSL vocabulary: the fields the typeahead completes, the
 * example snippets it suggests, and the AI query DSL derived from both.
 * Kept free of React and CodeMirror runtime imports so the AI query eval
 * suite can exercise the exact production DSL from Node.
 */

/**
 * The core fields of the span filter DSL that an expression can reference.
 * These double as the vocabulary taught to the AI query model, so each
 * `info` string should describe the field well enough to translate plain
 * language into it.
 */
export const coreSpanFilterCompletions: Completion[] = [
  {
    label: "span_kind",
    type: "variable",
    detail: "span category",
    info: "The span variant: CHAIN, LLM, RETRIEVER, TOOL, etc.",
  },
  {
    label: "status_code",
    type: "variable",
    detail: "OK, UNSET, or ERROR",
    info: "The span status: OK, UNSET, or ERROR",
  },
  {
    label: "status_message",
    type: "variable",
    detail: "status details",
    info: "The status message of a span, e.g. an error message",
  },
  {
    label: "input.value",
    type: "variable",
    detail: "span input",
    info: "The input value of a span, typically a query",
  },
  {
    label: "output.value",
    type: "variable",
    detail: "span output",
    info: "The output value of a span, typically a response",
  },
  {
    label: "name",
    type: "variable",
    detail: "operation name",
    info: "The name given to a span - e.g. OpenAI",
  },
  {
    label: "span_id",
    type: "variable",
    detail: "unique span ID",
    info: "The ID of a span",
  },
  {
    label: "trace_id",
    type: "variable",
    detail: "containing trace ID",
    info: "The ID of the trace a span belongs to",
  },
  {
    label: "parent_id",
    type: "variable",
    detail: "stored parent ID",
    info: "The stored ID of this span's parent. `parent_id is None` matches only spans with no parent ID; it excludes orphan spans whose parent ID points to a missing span.",
  },
  {
    label: "parent_span",
    type: "variable",
    detail: "resolved parent existence",
    info: "Whether this span's parent exists in Phoenix. `parent_span is None` matches spans with no parent ID and orphan spans whose parent is missing. Only comparisons with None are supported.",
  },
  {
    label: "latency_ms",
    type: "variable",
    detail: "duration in milliseconds",
    info: "Latency (i.e. duration) in milliseconds",
  },
  {
    label: "metadata",
    type: "variable",
    detail: "metadata by key",
    info: "The metadata of a span, accessed by key - e.g. metadata['topic']",
  },
  {
    label: "attributes",
    type: "variable",
    detail: "attributes by key",
    info: "Span attributes, accessed by key - e.g. attributes['llm']['provider']",
  },
  {
    label: "annotations",
    type: "variable",
    detail: "annotations by name",
    info: "Span annotations, accessed by name - e.g. annotations['quality'].score",
  },
  {
    label: "trace_annotations",
    type: "variable",
    detail: "trace annotations by name",
    info: "Trace annotations, accessed by name - e.g. trace_annotations['quality'].score",
  },
  {
    label: "evals",
    type: "variable",
    detail: "evaluations by name",
    info: "Span evaluations, accessed by name - e.g. evals['Hallucination'].label",
  },
  {
    // Referenced by the "filter by model name" snippet and by the AI query
    // examples, so it belongs in the vocabulary both read from.
    label: "llm.model_name",
    type: "variable",
    detail: "model of an LLM span",
    info: "The model an LLM span called, e.g. gpt-4o. Shorthand for attributes['llm']['model_name'].",
  },
  {
    label: "llm.token_count.prompt",
    type: "variable",
    detail: "prompt tokens",
    info: "Token count for the prompt of an LLM span",
  },
  {
    label: "llm.token_count.completion",
    type: "variable",
    detail: "completion tokens",
    info: "Token count for the completion of an LLM span",
  },
  {
    label: "llm.token_count.total",
    type: "variable",
    detail: "total LLM tokens",
    info: "Total token count (prompt + completion) of an LLM span",
  },
  {
    label: "cumulative_token_count.prompt",
    type: "variable",
    detail: "prompt tokens incl. descendants",
    info: "Sum of token count for prompt from self and all child spans",
  },
  {
    label: "cumulative_token_count.completion",
    type: "variable",
    detail: "completion tokens incl. descendants",
    info: "Sum of token count for completion from self and all child spans",
  },
  {
    label: "cumulative_token_count.total",
    type: "variable",
    detail: "total tokens incl. descendants",
    info: "Sum of token count total (prompt + completion) from self and all child spans",
  },
];

/**
 * Example conditions shown as suggestions in the typeahead — notably when
 * the empty field is focused. `${placeholder}` segments become tab-through
 * fields on insert. Ordered most-useful-first: only the first few are shown
 * while browsing; the rest surface via fuzzy matching as the user types.
 * Evaluation (`evals`) snippets are deliberately omitted — they're a legacy
 * alias for annotations and only crowd the list.
 */
export const spanFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "filter by errors",
    snippet: "status_code == 'ERROR'",
  },
  {
    label: "filter by span kind",
    snippet: "span_kind == '${LLM}'",
  },
  {
    label: "filter by LLM provider",
    snippet: "attributes['llm']['provider'] == '${openai}'",
  },
  {
    label: "filter by latency",
    snippet: "latency_ms >= ${10_000}",
  },
  {
    label: "search input for substring",
    snippet: "'${search text}' in input.value",
  },
  {
    label: "filter by annotation score",
    snippet: "annotations['${name}'].score >= ${0.5}",
  },
  {
    label: "filter by trace annotation score",
    snippet: "trace_annotations['${name}'].score >= ${0.5}",
  },
  {
    label: "filter by trace annotation label",
    snippet: "trace_annotations['${name}'].label == '${label}'",
  },
  {
    label: "search output for substring",
    snippet: "'${search text}' in output.value",
  },
  {
    label: "filter by span name",
    snippet: "name == '${name}'",
  },
  {
    label: "filter for spans with no parent ID",
    snippet: STRICT_ROOT_SPANS_CONDITION,
    info: "Matches only spans whose stored parent_id is None. Orphan spans with a parent ID are excluded.",
  },
  {
    label: "filter for spans with no parent span",
    snippet: ORPHAN_AWARE_ROOT_SPANS_CONDITION,
    info: "Matches spans with no parent ID and orphan spans whose parent ID points to a missing span.",
  },
  {
    label: "filter by trace id",
    snippet: "trace_id == '${trace id}'",
  },
  {
    label: "filter by token count",
    snippet: "cumulative_token_count.total > ${1_000}",
  },
  {
    label: "filter by model name",
    snippet: "llm.model_name == '${model}'",
  },
  {
    label: "filter by annotation label",
    snippet: "annotations['${name}'].label == '${label}'",
  },
  {
    label: "filter by metadata",
    snippet: "metadata['${key}'] == '${value}'",
  },
  {
    label: "filter by attribute",
    snippet: "attributes['${key}'] == '${value}'",
  },
];

/**
 * Requests phrased the way someone troubleshooting an agent phrases them,
 * paired with the expression each should produce. These teach idiom
 * selection — which of two near-synonymous fields to reach for, when a
 * substring beats an equality, how a missing value is tested — which the
 * field list alone cannot convey. The snippet labels these replace read as
 * menu entries ("filter by errors") rather than as anything a user types.
 *
 * Deliberately disjoint in surface content from `spanFilterCases` in the
 * eval suite: an example that reuses a case's literals turns that case into
 * a recall test and stops measuring translation.
 */
const spanFilterAIExamples = [
  { description: "errors", expression: "status_code == 'ERROR'" },
  {
    description: "LLM calls slower than 5 seconds",
    expression: "span_kind == 'LLM' and latency_ms > 5000",
  },
  {
    description: "spans that ran on openai",
    expression: "attributes['llm']['provider'] == 'openai'",
  },
  {
    description: "gpt-4o calls that failed",
    expression: "llm.model_name == 'gpt-4o' and status_code == 'ERROR'",
  },
  {
    description: "inputs that mention a refund",
    expression: "'refund' in input.value",
  },
  { description: "root spans", expression: STRICT_ROOT_SPANS_CONDITION },
  {
    description: "spans whose parent never made it into Phoenix",
    expression: ORPHAN_AWARE_ROOT_SPANS_CONDITION,
  },
  {
    description: "chain or agent spans",
    expression: "span_kind in ['CHAIN', 'AGENT']",
  },
  {
    description: "prompts between 1000 and 4000 tokens",
    expression: "1000 < llm.token_count.prompt < 4000",
  },
  {
    description: "traces that burned more than 10k tokens overall",
    expression: "cumulative_token_count.total > 10_000",
  },
  {
    description: "answers the Hallucination eval flagged",
    expression: "annotations['Hallucination'].label == 'hallucinated'",
  },
  {
    description: "a quality score of at least 0.5",
    expression: "annotations['quality'].score >= 0.5",
  },
  {
    description: "spans nobody scored for quality",
    expression: "not annotations['quality']",
  },
  {
    description: "spans tagged with the billing topic",
    expression: "metadata['topic'] == 'billing'",
  },
  {
    description: "spans with no user id recorded",
    expression: "metadata['user_id'] is None",
  },
  {
    description: "retriever or tool spans, but not timeouts",
    expression:
      "(span_kind == 'RETRIEVER' or span_kind == 'TOOL') and not ('timeout' in status_message)",
  },
];

/**
 * Everything the AI query model needs to translate plain language into the
 * span filter DSL. The field vocabulary is the typeahead's, so the two can
 * never drift apart; the examples are written for translation rather than
 * borrowed from the snippet menu. The OpenInference attribute expansion is
 * deliberately summarized as a note instead of enumerated: hundreds of
 * attribute paths would blow past the on-device model's small context window
 * without teaching it anything the subscript idiom doesn't.
 */
export const spanFilterAIQueryDSL = createAIQueryDSL({
  noun: "spans",
  completions: coreSpanFilterCompletions,
  snippets: spanFilterSnippets,
  examples: spanFilterAIExamples,
  notes: [
    "span_kind and status_code hold uppercase values: 'LLM', 'CHAIN', 'RETRIEVER', 'TOOL', 'EMBEDDING', 'AGENT'; 'OK', 'UNSET', 'ERROR'.",
    "Durations are in milliseconds: 5 seconds is latency_ms > 5000, two minutes is latency_ms > 120000.",
    "attributes and metadata are read by subscript and nest by chaining, e.g. attributes['llm']['provider'] == 'openai'. Span attributes follow OpenInference semantic conventions (llm.model_name, llm.provider, tool.name, retrieval.documents, embedding.model_name, session.id, ...), each also writable in dotted form, e.g. llm.model_name.",
    "A dotted path never goes inside one subscript: attributes['llm.provider'] matches nothing. Chain the keys — attributes['llm']['provider'] — or write the bare dotted form.",
    "annotations['name'] and evals['name'] access span annotations; trace_annotations['name'] accesses annotations attached to the containing trace. All expose .score, .label, and .explanation. Written bare, an annotation accessor tests whether it exists.",
    "llm.token_count.* counts a single LLM span; cumulative_token_count.* sums the span and every descendant, which is what a whole trace costs.",
    "A field may be tested against a list — span_kind in ['LLM', 'TOOL'] — and a range may be chained — 1000 < latency_ms < 5000.",
    `Root spans are selected with \`${STRICT_ROOT_SPANS_CONDITION}\`.`,
  ],
});
