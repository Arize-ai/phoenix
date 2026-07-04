import type { Completion } from "@codemirror/autocomplete";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { fetchQuery, graphql } from "relay-runtime";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import {
  createAnnotationMemberCompletions,
  DSLFilterConditionField,
  type DSLFilterSnippet,
  useDSLFilterConditionHistory,
} from "@phoenix/components/filter";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import environment from "@phoenix/RelayEnvironment";

import type { SpanFilterConditionFieldCompletionsQuery } from "./__generated__/SpanFilterConditionFieldCompletionsQuery.graphql";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import { useSpanFilters } from "./SpanFiltersContext";
import {
  openInferenceAttributeCompletions,
  openInferenceAttributeValueCompletionSource,
} from "./spanFilterSemanticConventionCompletions";
import { validateSpanFilterCondition } from "./spanFilterValidation";

/**
 * The fields of the span filter DSL that an expression can reference
 */
const spanFilterCompletions: Completion[] = [
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
    info: "The ID of a span's parent - None for root spans",
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
  ...openInferenceAttributeCompletions,
];

const spanFilterCompletionSources = [
  openInferenceAttributeValueCompletionSource,
];

/**
 * Example conditions shown as suggestions in the typeahead — notably when
 * the empty field is focused. `${placeholder}` segments become tab-through
 * fields on insert. Ordered most-useful-first: only the first few are shown
 * while browsing; the rest surface via fuzzy matching as the user types.
 * Evaluation (`evals`) snippets are deliberately omitted — they're a legacy
 * alias for annotations and only crowd the list.
 */
const spanFilterSnippets: DSLFilterSnippet[] = [
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
    snippet: "parent_id is None",
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
 * Fetches the annotation names that actually exist on the project's spans so
 * the typeahead can suggest real values rather than made-up examples
 */
async function fetchAnnotationCompletions(
  projectId: string
): Promise<Completion[]> {
  const data = await fetchQuery<SpanFilterConditionFieldCompletionsQuery>(
    environment,
    graphql`
      query SpanFilterConditionFieldCompletionsQuery($id: ID!) {
        project: node(id: $id) {
          ... on Project {
            spanAnnotationNames
          }
        }
      }
    `,
    { id: projectId }
  ).toPromise();
  return createAnnotationMemberCompletions({
    accessor: "annotations",
    noun: "annotation",
    sectionName: "Annotations",
    // notes are a pseudo-annotation deliberately hidden from
    // annotation-name surfaces
    names: getNonNoteAnnotationNames(data?.project?.spanAnnotationNames ?? []),
  });
}

type SpanFilterConditionFieldProps = {
  /**
   * Callback when the condition is valid
   */
  onValidCondition: (condition: string) => void;
  placeholder?: string;
};
export function SpanFilterConditionField(props: SpanFilterConditionFieldProps) {
  const {
    onValidCondition,
    placeholder = "filter condition (e.x. span_kind == 'LLM')",
  } = props;
  const [isConditionValid, setIsConditionValid] = useState<boolean>(true);
  const { filterCondition, setFilterCondition } = useSpanFilters();
  const deferredFilterCondition = useDeferredValue(filterCondition);

  const projectId = useTracingContext((state) => state.projectId);

  // Stable identities: the field caches completions per loader, and its
  // validation effect keys on validateCondition — an unstable identity
  // there would re-run validation on every validity flip, endlessly
  const { loadAnnotationCompletions, validateCondition } = useMemo(
    () => ({
      loadAnnotationCompletions: projectId
        ? () => fetchAnnotationCompletions(projectId)
        : undefined,
      validateCondition: (condition: string) =>
        validateSpanFilterCondition(condition, projectId),
    }),
    [projectId]
  );

  // Recent searches are keyed per project rather than globally: filter
  // expressions routinely reference project-specific names (annotations,
  // metadata keys), so another project's history would be noise
  const {
    completionSource: recentSearchesCompletionSource,
    recordValidCondition,
  } = useDSLFilterConditionHistory({
    historyKey: `span-filter-${projectId}`,
  });

  const completionSources = useMemo(
    () => [recentSearchesCompletionSource, ...spanFilterCompletionSources],
    [recentSearchesCompletionSource]
  );

  const handleValidCondition = useCallback(
    (condition: string) => {
      recordValidCondition(condition);
      onValidCondition(condition);
    },
    [recordValidCondition, onValidCondition]
  );

  // Advertise a project context that carries the current spanFilter while
  // the field is mounted. The merge in `selectActiveContexts` layers this
  // on top of the route-derived project context (which carries no filter)
  // so the server sees a single project entry with the filter included.
  // An in-progress invalid edit surfaces as empty rather than a known-bad
  // expression.
  let advertisedContext: AgentContext | null = null;
  if (projectId) {
    const trimmed = deferredFilterCondition.trim();
    const spanFilter = isConditionValid && trimmed ? trimmed : "";
    advertisedContext = {
      type: "project",
      projectNodeId: projectId,
      spanFilter,
    };
  }

  // Keep the agent's mounted UI context aligned with the current validated
  // filter expression while this field is rendered. The matching agent
  // client action for `set_spans_filter` is registered by
  // `SpanFiltersProvider`, which owns the underlying state.
  useAdvertiseAgentContext(advertisedContext);

  return (
    <DSLFilterConditionField
      aria-label="Filter spans"
      value={filterCondition}
      onChange={setFilterCondition}
      placeholder={placeholder}
      completions={spanFilterCompletions}
      snippets={spanFilterSnippets}
      completionSources={completionSources}
      loadCompletions={loadAnnotationCompletions}
      validateCondition={validateCondition}
      onValidCondition={handleValidCondition}
      onValidationStateChange={setIsConditionValid}
    />
  );
}
