import type { Completion } from "@codemirror/autocomplete";

import { createAIQueryDSL } from "@phoenix/components/filter/ai/createAIQueryDSL";
import type { DSLFilterSnippet } from "@phoenix/components/filter/DSLFilterConditionField";

import {
  traceFilterCoreVocabulary,
  type TraceFilterCoreVocabularyTerm,
} from "./traceFilterCoreVocabulary.generated";

export type TraceFilterVocabularyTerm = Omit<
  TraceFilterCoreVocabularyTerm,
  "iterableName"
> & {
  readonly iterableName?: string | null;
};

/** Loop variables used to qualify fields that only bind inside comprehensions. */
export const traceFilterLoopVariables: Partial<Record<string, string>> = {
  spans: "span",
  trace_annotations: "annotation",
  span_annotations: "annotation",
  span_cost_details: "cost_detail",
};

export function getTraceFilterLoopVariable(iterableName: string): string {
  return (
    traceFilterLoopVariables[iterableName] ??
    (iterableName.endsWith("s") ? iterableName.slice(0, -1) : "item")
  );
}

export function getTraceFilterAIFieldName(
  term: TraceFilterCoreVocabularyTerm
): string {
  if (term.name === "attributes[...]") {
    return "attributes['key']";
  }
  if (!term.iterableName) {
    return term.name;
  }
  return `${getTraceFilterLoopVariable(term.iterableName)}.${term.name}`;
}

const traceFilterAICompletions: Completion[] = traceFilterCoreVocabulary.map(
  (term) => ({
    label: getTraceFilterAIFieldName(term),
    type: "variable",
    detail: term.type,
    info: term.description,
  })
);

export const traceFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "search input and output for text",
    snippet: "'${search text}' in input or '${search text}' in output",
    boost: 1,
  },
  {
    label: "filter by number of spans",
    snippet: "num_spans >= ${5}",
  },
  {
    label: "any span errored",
    snippet: 'any(span.status_code == "ERROR" for span in spans)',
  },
  {
    label: "slowest span in the trace",
    snippet: "max(span.latency_ms for span in spans) > ${5_000}",
  },
  {
    label: "any span has an errored child",
    snippet:
      'any(any(child.status_code == "ERROR" for child in span.children) for span in spans)',
  },
  {
    label: "direct child of the trace root",
    snippet:
      "any(span.parent_span is not None and span.parent_span.parent_id is None for span in spans)",
  },
  {
    label: "combine trace and span conditions",
    snippet:
      'num_spans >= ${5} and any(span.status_code == "ERROR" for span in spans)',
  },
  {
    label: "filter by errors",
    snippet: "error_count > 0",
  },
  {
    label: "filter by duration",
    snippet: "latency_ms >= ${10_000}",
  },
  {
    label: "filter by trace id",
    snippet: "trace_id == '${trace id}'",
  },
  {
    label: "filter by total tokens",
    snippet: "token_count_total > ${1_000}",
  },
  {
    label: "filter by total cost",
    snippet: "total_cost > ${1}",
  },
  {
    label: "filter by tool usage",
    snippet: "tool_span_count > 0",
  },
  {
    label: "filter by user",
    snippet: "user.id == '${user id}'",
  },
  {
    label: "filter by metadata",
    snippet: "metadata[\"${key}\"] == '${value}'",
  },
  {
    label: "filter by annotation score",
    snippet: 'trace_annotations["${name}"].score >= ${0.5}',
  },
  {
    label: "filter by annotation label",
    snippet: "trace_annotations[\"${name}\"].label == '${label}'",
  },
  {
    label: "search input for substring",
    snippet: "'${search text}' in input",
  },
  {
    label: "search output for substring",
    snippet: "'${search text}' in output",
  },
  {
    label: "any span matches a condition",
    snippet: "any(${span.latency_ms > 1000} for span in ${spans})",
  },
  {
    label: "all spans match a condition",
    snippet:
      "len([span for span in ${spans}]) > 0 and all(${span.latency_ms < 1000} for span in ${spans})",
  },
  {
    label: "count spans matching a condition",
    snippet:
      'len([span for span in spans if span.span_kind == "${TOOL}"]) >= ${2}',
  },
];

const traceFilterAIExamples = [
  {
    description: "traces longer than thirty seconds",
    expression: "latency_ms > 30_000",
  },
  {
    description: "traces with more than twelve spans",
    expression: "num_spans > 12",
  },
  {
    description: "traces containing a retriever span",
    expression: "any(span.span_kind == 'RETRIEVER' for span in spans)",
  },
  {
    description: "traces where every span completed successfully",
    expression:
      "len([span for span in spans]) > 0 and all(span.status_code == 'OK' for span in spans)",
  },
  {
    description: "traces whose spans used over eight thousand prompt tokens",
    expression: "sum(span.llm_token_count_prompt for span in spans) > 8_000",
  },
  {
    description: "traces with a failed child span",
    expression:
      "any(any(child.status_code == 'ERROR' for child in span.children) for span in spans)",
  },
  {
    description: "traces from the preview deployment",
    expression: "metadata['deployment'] == 'preview'",
  },
  {
    description: "traces the relevance annotation labeled poor",
    expression: "trace_annotations['relevance'].label == 'poor'",
  },
  {
    description: "traces with no safety score",
    expression: "trace_annotations['safety'].score is None",
  },
];

export const traceFilterAIQueryDSL = createAIQueryDSL({
  noun: "traces",
  completions: traceFilterAICompletions,
  snippets: traceFilterSnippets,
  examples: traceFilterAIExamples,
  notes: [
    "Trace and span durations are in milliseconds. Convert seconds and minutes before comparing.",
    "start_time, end_time, span.start_time, and span.end_time compare against ISO 8601 strings; prefer offset-bearing literals.",
    "input and output are the displayed root span's string values and support containment, for example 'refund' in input.",
    "Use any, all, len, max, min, and sum with Python-style comprehensions. Element fields are qualified by the loop variable, such as span.latency_ms or annotation.score.",
    "Guard all with a non-empty check when empty collections should not match. Filtered max and min produce None for an empty set, so ordinary comparisons do not match; len and sum produce zero.",
    "A span exposes span.children, span.siblings, span.annotations, and span.cost_details for nested comprehensions. Each collection introduces its own loop variable, and an inner comprehension may refer back to its enclosing span, such as sibling.name == span.name.",
    "The direct-parent relation is span.parent_span, not span.parent. Use span.parent_span.<field> for parent fields and guard with span.parent_span is not None when needed. span.parent_span is None includes dangling-parent orphans; span.parent_id is None identifies only spans with no parent edge.",
    "Annotation grain is explicit: keyed trace annotations use trace_annotations['name'].score or .label. Span annotations are iterated through span_annotations or span.annotations; annotations[...] is not valid.",
    "Project-specific trace annotation names and displayed-root attribute keys are discovered at runtime. Preserve names from the request verbatim in trace_annotations['name'], metadata['key'], user.id, or attributes['otel.key']; do not invent near-synonyms.",
    "attributes string subscripts are OpenTelemetry wire keys. attributes['llm.model_name'] and attributes['llm']['model_name'] name the same key.",
    "error_count, tool_span_count, and llm_span_count are trace-wide span counts. token_count_* sums LLM spans, while *_cost sums configured span costs.",
    "The only helpers are any, all, len, max, min, sum, str, and float. sorted(), list indexing, and slicing are not supported — approximate a percentile with max() or a threshold count instead.",
  ],
});
