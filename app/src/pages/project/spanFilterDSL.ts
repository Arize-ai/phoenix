import type { Completion } from "@codemirror/autocomplete";

import { createAISearchDSL } from "@phoenix/components/filter/ai/createAISearchDSL";
import type { DSLFilterSnippet } from "@phoenix/components/filter/DSLFilterConditionField";

import {
  ORPHAN_AWARE_ROOT_SPANS_CONDITION,
  STRICT_ROOT_SPANS_CONDITION,
} from "./spanFilterRootScopeConstants";

/**
 * The span filter DSL vocabulary: the fields the typeahead completes, the
 * example snippets it suggests, and the AI search DSL derived from both.
 * Kept free of React and CodeMirror runtime imports so the AI search eval
 * suite can exercise the exact production DSL from Node.
 */

/**
 * The core fields of the span filter DSL that an expression can reference.
 * These double as the vocabulary taught to the AI search model, so each
 * `info` string should describe the field well enough to translate plain
 * language into it.
 */
export const coreSpanFilterCompletions: Completion[] = [
  {
    label: "span_kind",
    type: "variable",
    info: "The span variant: CHAIN, LLM, RETRIEVER, TOOL, etc.",
  },
  {
    label: "status_code",
    type: "variable",
    info: "The span status: OK, UNSET, or ERROR",
  },
  {
    label: "status_message",
    type: "variable",
    info: "The status message of a span, e.x. an error message",
  },
  {
    label: "input.value",
    type: "variable",
    info: "The input value of a span, typically a query",
  },
  {
    label: "output.value",
    type: "variable",
    info: "The output value of a span, typically a response",
  },
  {
    label: "name",
    type: "variable",
    info: "The name given to a span - e.x. OpenAI",
  },
  {
    label: "span_id",
    type: "variable",
    info: "The ID of a span",
  },
  {
    label: "trace_id",
    type: "variable",
    info: "The ID of the trace a span belongs to",
  },
  {
    label: "parent_id",
    type: "variable",
    info: "The ID of a span's parent - use `parent_id is None` for root spans",
  },
  {
    label: "parent_span",
    type: "variable",
    info: "The parent span - use `parent_span is None` for root spans, including orphans (spans whose parent is missing)",
  },
  {
    label: "latency_ms",
    type: "variable",
    info: "Latency (i.e. duration) in milliseconds",
  },
  {
    label: "metadata",
    type: "variable",
    info: "The metadata of a span, accessed by key - e.x. metadata['topic']",
  },
  {
    label: "attributes",
    type: "variable",
    info: "Span attributes, accessed by key - e.x. attributes['llm']['provider']",
  },
  {
    label: "annotations",
    type: "variable",
    info: "Span annotations, accessed by name - e.x. annotations['quality'].score",
  },
  {
    label: "evals",
    type: "variable",
    info: "Span evaluations, accessed by name - e.x. evals['Hallucination'].label",
  },
  {
    label: "llm.token_count.prompt",
    type: "variable",
    info: "Token count for the prompt of an LLM span",
  },
  {
    label: "llm.token_count.completion",
    type: "variable",
    info: "Token count for the completion of an LLM span",
  },
  {
    label: "llm.token_count.total",
    type: "variable",
    info: "Total token count (prompt + completion) of an LLM span",
  },
  {
    label: "cumulative_token_count.prompt",
    type: "variable",
    info: "Sum of token count for prompt from self and all child spans",
  },
  {
    label: "cumulative_token_count.completion",
    type: "variable",
    info: "Sum of token count for completion from self and all child spans",
  },
  {
    label: "cumulative_token_count.total",
    type: "variable",
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
    label: "search output for substring",
    snippet: "'${search text}' in output.value",
  },
  {
    label: "filter by span name",
    snippet: "name == '${name}'",
  },
  {
    label: "filter for root spans",
    snippet: STRICT_ROOT_SPANS_CONDITION,
  },
  {
    label: "filter for root spans (incl. orphans)",
    snippet: ORPHAN_AWARE_ROOT_SPANS_CONDITION,
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
    label: "search annotation explanation",
    snippet: "'${search text}' in annotations['${name}'].explanation",
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
 * Everything the AI search model needs to translate plain language into the
 * span filter DSL — the same vocabulary and examples that power the
 * typeahead, so the two can never drift apart. The OpenInference attribute
 * expansion is deliberately summarized as a note instead of enumerated:
 * hundreds of attribute paths would blow past the on-device model's small
 * context window without teaching it anything the subscript idiom doesn't.
 */
export const spanFilterAISearchDSL = createAISearchDSL({
  noun: "spans",
  completions: coreSpanFilterCompletions,
  snippets: spanFilterSnippets,
  notes: [
    `Root spans are selected with \`${STRICT_ROOT_SPANS_CONDITION}\`.`,
    "attributes and metadata are accessed by subscript, e.g. attributes['llm']['provider'] == 'openai'. Span attributes follow OpenInference semantic conventions (llm.model_name, llm.provider, retrieval.documents, embedding.model_name, tool.name, ...).",
    "Durations are in milliseconds, e.g. 5 seconds is latency_ms > 5000.",
  ],
});
