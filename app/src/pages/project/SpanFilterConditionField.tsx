import type { Completion } from "@codemirror/autocomplete";
import {
  useCallback,
  useDeferredValue,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
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
  initialCondition?: string;
  placeholder?: string;
};
/**
 * Context-connected span filter field for the tracing pages. Reads the span
 * filter state and project id from `SpanFiltersProvider`/`TracingProvider` and
 * delegates rendering to the context-free {@link SpanFilterConditionFieldCore}.
 */
export function SpanFilterConditionField(props: SpanFilterConditionFieldProps) {
  const {
    onValidCondition,
    initialCondition,
    placeholder = "filter condition (e.x. span_kind == 'LLM')",
  } = props;
  const spanFilters = useSpanFilters();
  const projectId = useTracingContext((state) => state.projectId);
  // When an initialCondition is provided the field manages its own local
  // condition (e.g. inside the evaluator panel) instead of the shared
  // span-filters context that drives the tracing views.
  const [localFilterCondition, setLocalFilterCondition] = useState(
    initialCondition ?? ""
  );
  const hasLocalCondition = initialCondition !== undefined;
  const filterCondition = hasLocalCondition
    ? localFilterCondition
    : spanFilters.filterCondition;
  const setFilterCondition = hasLocalCondition
    ? setLocalFilterCondition
    : spanFilters.setFilterCondition;
  return (
    <SpanFilterConditionFieldCore
      projectId={projectId}
      filterCondition={filterCondition}
      onFilterConditionChange={setFilterCondition}
      onValidCondition={onValidCondition}
      placeholder={placeholder}
      advertiseFilterToAgent
    />
  );
}

export type SpanFilterConditionFieldCoreProps = {
  /** The project whose spans the filter condition validates against. */
  projectId?: string;
  /** The current filter condition text (controlled). */
  filterCondition: string;
  /** Called on every edit to the filter condition text. */
  onFilterConditionChange: (condition: string) => void;
  /** Called when the current condition validates as usable. */
  onValidCondition: (condition: string) => void;
  /**
   * Called whenever the condition's validity changes. An empty condition is
   * treated as valid (unfiltered).
   */
  onValidityChange?: (isValid: boolean) => void;
  placeholder?: string;
  /**
   * Advertise the current valid filter to the agent as project context. Only
   * the tracing pages register the matching `set_spans_filter` client action,
   * so only they should opt in.
   */
  advertiseFilterToAgent?: boolean;
};

/**
 * Context-free span filter condition field. Delegates editing, completions,
 * and validation to {@link DSLFilterConditionField}, but takes all filter
 * state and the project id as props so it can mount outside
 * `SpanFiltersProvider`/`TracingProvider`.
 */
export function SpanFilterConditionFieldCore(
  props: SpanFilterConditionFieldCoreProps
) {
  const {
    projectId,
    filterCondition,
    onFilterConditionChange,
    onValidCondition,
    onValidityChange,
    placeholder = "filter condition (e.x. span_kind == 'LLM')",
    advertiseFilterToAgent = false,
  } = props;
  const [isConditionValid, setIsConditionValid] = useState<boolean>(true);
  const deferredFilterCondition = useDeferredValue(filterCondition);
  // The callback props are event handlers, not reactive inputs: the DSL
  // field's validation effect keys on its callbacks, so a parent that passes
  // a fresh closure per render would re-fire validation, reset validity,
  // re-render, and produce yet another closure — an unbounded
  // validation-request loop. Wrap them as effect events so validation reacts
  // only to the condition text and project.
  const emitValidCondition = useEffectEvent((condition: string) => {
    onValidCondition(condition);
  });
  const emitValidityChange = useEffectEvent((isValid: boolean) => {
    onValidityChange?.(isValid);
  });

  // Stable identities: the field caches completions per loader, and its
  // validation effect keys on validateCondition — an unstable identity
  // there would re-run validation on every validity flip, endlessly
  const { loadAnnotationCompletions, validateCondition } = useMemo(
    () => ({
      loadAnnotationCompletions: projectId
        ? () => fetchAnnotationCompletions(projectId)
        : undefined,
      validateCondition: (condition: string) =>
        // Without a project there is nothing to validate against; treat the
        // condition as valid rather than blocking the caller.
        projectId
          ? validateSpanFilterCondition(condition, projectId)
          : Promise.resolve({ isValid: true, errorMessage: null }),
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
      emitValidCondition(condition);
    },
    [recordValidCondition, emitValidCondition]
  );

  const handleValidationStateChange = useCallback(
    (isValid: boolean) => {
      setIsConditionValid(isValid);
      emitValidityChange(isValid);
    },
    [emitValidityChange]
  );

  // Advertise a project context that carries the current spanFilter while
  // the field is mounted. The merge in `selectActiveContexts` layers this
  // on top of the route-derived project context (which carries no filter)
  // so the server sees a single project entry with the filter included.
  // An in-progress invalid edit surfaces as empty rather than a known-bad
  // expression.
  let advertisedContext: AgentContext | null = null;
  if (advertiseFilterToAgent && projectId) {
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
      onChange={onFilterConditionChange}
      placeholder={placeholder}
      completions={spanFilterCompletions}
      snippets={spanFilterSnippets}
      completionSources={completionSources}
      loadCompletions={loadAnnotationCompletions}
      validateCondition={validateCondition}
      onValidCondition={handleValidCondition}
      onValidationStateChange={handleValidationStateChange}
    />
  );
}
