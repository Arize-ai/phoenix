import type { Completion } from "@codemirror/autocomplete";

import { createAIQueryDSL } from "@phoenix/components/filter/ai/createAIQueryDSL";
import type { DSLFilterSnippet } from "@phoenix/components/filter/DSLFilterConditionField";

import {
  sessionFilterCoreVocabulary,
  type SessionFilterCoreVocabularyTerm,
} from "./sessionFilterCoreVocabulary.generated";

export type SessionFilterVocabularyTerm = Omit<
  SessionFilterCoreVocabularyTerm,
  "iterableName"
> & {
  readonly iterableName?: string | null;
};

/**
 * The session compiler rejects a bare element name, so element fields are
 * qualified by these loop variables.
 */
export const sessionFilterLoopVariables: Partial<Record<string, string>> = {
  spans: "span",
  traces: "trace",
  session_annotations: "annotation",
  span_annotations: "annotation",
  span_cost_details: "cost_detail",
};

export function getSessionFilterLoopVariable(iterableName: string): string {
  return (
    sessionFilterLoopVariables[iterableName] ??
    (iterableName.endsWith("s") ? iterableName.slice(0, -1) : "item")
  );
}

function getAIQueryFieldName(term: SessionFilterCoreVocabularyTerm): string {
  if (!term.iterableName) {
    return term.name;
  }
  return `${getSessionFilterLoopVariable(term.iterableName)}.${term.name}`;
}

const sessionFilterAICompletions: Completion[] =
  sessionFilterCoreVocabulary.map((term) => ({
    label: getAIQueryFieldName(term),
    type: "variable",
    detail: term.type,
    info: term.description,
  }));

export const sessionFilterSnippets: DSLFilterSnippet[] = [
  {
    label: "search inputs and outputs for text",
    snippet: "'${search text}' in any_input or '${search text}' in any_output",
    boost: 1,
  },
  {
    label: "filter by number of traces",
    snippet: "num_traces >= ${5}",
  },
  {
    label: "any span errored",
    snippet: 'any(span.status_code == "ERROR" for span in spans)',
  },
  {
    label: "slowest span in the session",
    snippet: "max(span.latency_ms for span in spans) > ${5_000}",
  },
  {
    label: "any trace used a tool",
    snippet:
      'any(any(span.span_kind == "TOOL" for span in trace.spans) for trace in traces)',
  },
  {
    label: "combine session and span conditions",
    snippet:
      'num_traces >= ${5} and any(span.status_code == "ERROR" for span in spans)',
  },
  {
    label: "filter by errors",
    snippet: "num_traces_with_error > 0",
  },
  {
    label: "filter by duration",
    snippet: "duration_ms >= ${10_000}",
  },
  {
    label: "filter by session id",
    snippet: "session_id == '${session id}'",
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
    snippet: 'annotations["${name}"].score >= ${0.5}',
  },
  {
    label: "filter by annotation label",
    snippet: "annotations[\"${name}\"].label == '${label}'",
  },
  {
    label: "search inputs for substring",
    snippet: "'${search text}' in any_input",
  },
  {
    label: "search outputs for substring",
    snippet: "'${search text}' in any_output",
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
  {
    label: "any trace matches a condition",
    snippet: "any(${trace.latency_ms > 10_000} for trace in ${traces})",
  },
];

const sessionFilterAIExamples = [
  {
    description: "sessions longer than forty-five seconds",
    expression: "duration_ms > 45_000",
  },
  {
    description: "sessions with more than eight traces",
    expression: "num_traces > 8",
  },
  {
    description: "sessions with a span slower than three seconds",
    expression: "any(span.latency_ms > 3_000 for span in spans)",
  },
  {
    description: "sessions where every span finished within two seconds",
    expression:
      "len([span for span in spans]) > 0 and all(span.latency_ms < 2_000 for span in spans)",
  },
  {
    description: "sessions whose spans used over twelve thousand output tokens",
    expression:
      "sum(span.llm_token_count_completion for span in spans) > 12_000",
  },
  {
    description: "sessions with a retriever span in any trace",
    expression:
      "any(any(span.span_kind == 'RETRIEVER' for span in trace.spans) for trace in traces)",
  },
  {
    description: "sessions from the staging deployment",
    expression: "metadata['deployment'] == 'staging'",
  },
  {
    description: "sessions the quality annotation labeled bad",
    expression: "annotations['quality'].label == 'bad'",
  },
  {
    description: "sessions with no helpfulness annotation",
    expression: "annotations['helpfulness'].score is None",
  },
];

export const sessionFilterAIQueryDSL = createAIQueryDSL({
  noun: "sessions",
  completions: sessionFilterAICompletions,
  snippets: sessionFilterSnippets,
  examples: sessionFilterAIExamples,
  notes: [
    "Durations and span or trace latency are in milliseconds. Convert seconds and minutes before comparing.",
    "start_time, end_time, trace.start_time, and trace.end_time compare against ISO 8601 strings; prefer offset-bearing literals.",
    "any_input and any_output are containment targets: write 'text' in any_input, not any_input == 'text'. first_input and last_output are string values.",
    "Use any, all, len, max, min, and sum with Python-style comprehensions. Element fields are qualified by the loop variable, such as span.latency_ms or trace.start_time.",
    "Guard all with a non-empty check when empty collections should not match, for example len([span for span in spans]) > 0 and all(... for span in spans).",
    "A trace exposes trace.spans for nested comprehensions over the spans in that trace.",
    "Project-specific session annotation names and root-span attribute keys are discovered at runtime. Preserve names from the request verbatim in annotations['name'], metadata['key'], user.id, or attributes['otel.key']; do not invent near-synonyms.",
    "attributes string subscripts are OTel wire keys. attributes['llm.model_name'] and attributes['llm']['model_name'] name the same key.",
    "num_traces is an approximate conversation-turn count only when instrumentation starts one trace per exchange. tool_span_count counts TOOL spans.",
    "The only helpers are any, all, len, max, min, and sum over comprehensions. sorted(), list indexing, and slicing are not supported — approximate a percentile with max() or a threshold count instead.",
  ],
});
