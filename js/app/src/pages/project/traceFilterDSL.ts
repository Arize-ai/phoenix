import type { Completion } from "@codemirror/autocomplete";

import { createAIQueryDSL } from "@phoenix/components/filter/ai/createAIQueryDSL";
import type { DSLFilterSnippet } from "@phoenix/components/filter/DSLFilterConditionField";

export type TraceFilterVocabularyTerm = {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly category: string;
  readonly iterableName?: string | null;
};

const traceFilterLoopVariables: Partial<Record<string, string>> = {
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

function getTraceFilterAIFieldName(term: TraceFilterVocabularyTerm): string {
  // The vocabulary's placeholder term for arbitrary attribute subscripts is
  // spelled `attributes[...]`, which the compiler rejects verbatim; teach the
  // model the writable form instead.
  if (term.name === "attributes[...]") {
    return "attributes['key']";
  }
  if (!term.iterableName) {
    return term.name;
  }
  return `${getTraceFilterLoopVariable(term.iterableName)}.${term.name}`;
}

function getTraceFilterAICompletions(
  vocabulary: readonly TraceFilterVocabularyTerm[]
): Completion[] {
  return vocabulary.map((term) => ({
    label: getTraceFilterAIFieldName(term),
    type: "variable",
    detail: term.type,
    info: term.description,
  }));
}

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
  {
    description: "traces that called at least three tools",
    expression:
      "len([span for span in spans if span.span_kind == 'TOOL']) >= 3",
  },
  {
    description: "traces with a span that cost over five cents",
    expression:
      "any(sum(detail.cost for detail in span.cost_details) > 0.05 for span in spans)",
  },
  {
    description: "traces where a guardrail ran after the model answered",
    expression:
      "max(span.start_time for span in spans if span.span_kind == 'GUARDRAIL') > max(span.start_time for span in spans if span.span_kind == 'LLM')",
  },
  {
    description: "traces where a planner step used over a thousand tokens",
    expression:
      "any('planner' in span.name and span.cumulative_llm_token_count_total > 1_000 for span in spans)",
  },
  {
    description: "traces where one span accounts for over half the tokens",
    expression:
      "max(span.cumulative_llm_token_count_total for span in spans) > 0.5 * token_count_total",
  },
  {
    description: "traces where a chain fanned out to more than five children",
    expression:
      "any(span.span_kind == 'CHAIN' and len([child for child in span.children]) > 5 for span in spans)",
  },
];

export function createTraceFilterAIQueryDSL(
  vocabulary: readonly TraceFilterVocabularyTerm[]
) {
  return createAIQueryDSL({
    noun: "traces",
    completions: getTraceFilterAICompletions(vocabulary),
    snippets: traceFilterSnippets,
    examples: traceFilterAIExamples,
    notes: [
      "Trace and span durations are in milliseconds. Convert seconds and minutes before comparing.",
      "start_time, end_time, span.start_time, and span.end_time compare against ISO 8601 strings; prefer offset-bearing literals.",
      "input and output are the displayed root span's string values and support containment, for example 'refund' in input.",
      "any, all, len, max, min, and sum all take a comprehension over a collection, with or without brackets: any(span.status_code == 'ERROR' for span in spans) and max([span.latency_ms for span in spans]) are both fine. len is the one that requires the brackets — len([span for span in spans if span.span_kind == 'TOOL']) — while len(spans), len(span.children), and len(... for ...) are rejected.",
      "A comprehension has exactly one for clause, and every loop variable in the expression must be distinct. Reach a nested collection by nesting comprehensions: any(any(child.span_kind == 'TOOL' for child in span.children) for span in spans).",
      "Trace-level fields — num_spans, error_count, latency_ms, start_time, end_time, token_count_*, *_cost, input, output — describe the whole trace and cannot appear inside a comprehension over spans. Whenever one span's field must be measured against a trace-level field, lift the comparison out of the comprehension: write max(span.cumulative_llm_token_count_total for span in spans) > 0.8 * token_count_total, never any(span.cumulative_llm_token_count_total > 0.8 * token_count_total for span in spans).",
      "Guard all with a non-empty check when empty collections should not match. Filtered max and min produce None for an empty set, so ordinary comparisons do not match; len and sum produce zero.",
      "A span exposes span.children, span.siblings, span.annotations, and span.cost_details. spans is every span in the trace, and children and siblings are strictly narrower views of it — scan spans unless the request itself limits the scope to one span's children or siblings. An inner comprehension may refer back to its enclosing span, such as sibling.name == span.name.",
      "The direct-parent relation is span.parent_span, not span.parent. Use span.parent_span.<field> for parent fields and guard with span.parent_span is not None when needed; parent_span exposes the parent's own fields only, so span.parent_span.children and span.parent_span.annotations are rejected. span.parent_span is None includes dangling-parent orphans; span.parent_id is None identifies only spans with no parent edge.",
      "span.span_kind is the span's category: LLM, TOOL, AGENT, CHAIN, RETRIEVER, EMBEDDING, RERANKER, or GUARDRAIL. A request naming one of those categories — an agent span, a tool call, a retriever — means span.span_kind. A request naming a component, step, or role that is not a category — a subagent, the finalize step, a planner — means span.name, matched by containment, because span names carry prefixes and suffixes: 'subagent' in span.name.",
      "A span described as under, inside, beneath, or launched by another is reached through span.parent_span: the qualifier describes the parent, so it becomes 'subagent' in span.parent_span.name, while span.span_kind and span.annotations still describe the span itself.",
      "A relation clause says nothing about the kind of the span at its other end. When the request describes one span's children, siblings, or parent, constrain only the end it actually names and leave the other end's span_kind unconstrained.",
      "A span's identity is its name, so a retry, repeat, or duplicate of a span is another span carrying the same name. Correlate it from the nested comprehension — other.name == span.name and other.start_time > span.start_time — rather than matching only its kind.",
      "span.llm_token_count_*, span.latency_ms, and span.status_code describe that span alone; span.cumulative_* aggregate the span together with every span beneath it. Work done anywhere under a named span — or its absence — is a cumulative_ field on that span, not its own count and not the trace-wide total. A span that is not itself an LLM span records llm_token_count_total == 0 whatever its subtree did, so that field can never answer whether a component did LLM work; cumulative_llm_token_count_total can.",
      "A span has no single cost field. span.cost_details holds one row per token type, so a span's own cost is sum(detail.cost for detail in span.cost_details) — one row is a component of that cost, never the whole of it. total_cost, prompt_cost, and completion_cost are trace-wide.",
      "Nothing sorts, ranks, or orders. Express one event following another by comparing timestamps across two filtered reductions: max(span.start_time for span in spans if <later>) > max(span.start_time for span in spans if <earlier>). Compare start_time to start_time unless the request is about completion.",
      "Annotation grain is explicit: keyed trace annotations use trace_annotations['name'].score or .label. Span annotations are iterated through span_annotations or span.annotations; annotations[...] is not valid. An annotation's identity is annotation.name, annotation.label is its categorical verdict, and annotation.score is its number — never match a name against label.",
      "Project-specific trace annotation names and displayed-root attribute keys are discovered at runtime. Preserve names from the request verbatim in trace_annotations['name'], metadata['key'], user.id, or attributes['otel.key']; do not invent near-synonyms.",
      "Span names, kinds, statuses, and annotation names taken from the request are identifiers, not described free text: match them as given, without capitalization variants, synonyms, or added spellings.",
      "attributes string subscripts are OpenTelemetry wire keys. attributes['llm.model_name'] and attributes['llm']['model_name'] name the same key.",
      "error_count, tool_span_count, and llm_span_count are trace-wide span counts with no span-level equivalents. token_count_* sums LLM spans, while *_cost sums configured span costs.",
      "The only helpers are any, all, len, max, min, sum, str, and float. There are no method calls — no .lower(), no .startswith() — and no sorted(), list indexing, or slicing; approximate a percentile with max() or a threshold count instead.",
    ],
  });
}
