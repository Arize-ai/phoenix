import type { Completion } from "@codemirror/autocomplete";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { fetchQuery, graphql } from "relay-runtime";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import {
  AIQueryDSLFilterField,
  createAnnotationMemberCompletions,
  type DSLFilterAIQueryProps,
  type DSLFilterValidationFailureReason,
  type DSLFilterValidConditionArgs,
  useDSLFilterConditionHistory,
} from "@phoenix/components/filter";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import environment from "@phoenix/RelayEnvironment";

import type { SpanFilterConditionFieldCompletionsQuery } from "./__generated__/SpanFilterConditionFieldCompletionsQuery.graphql";
import { getNonNoteAnnotationNames } from "./spanAnnotationUtils";
import {
  coreSpanFilterCompletions,
  spanFilterAIQueryDSL,
  spanFilterSnippets,
} from "./spanFilterDSL";
import {
  useSpanFilterActions,
  useSpanFilterCondition,
} from "./SpanFiltersContext";
import {
  openInferenceAttributeCompletions,
  openInferenceAttributeValueCompletionSource,
} from "./spanFilterSemanticConventionCompletions";
import {
  type SpanFilterConditionValidation,
  validateSpanFilterCondition,
} from "./spanFilterValidation";

const spanFilterCompletions: Completion[] = [
  ...coreSpanFilterCompletions,
  ...openInferenceAttributeCompletions,
];

const spanFilterCompletionSources = [
  openInferenceAttributeValueCompletionSource,
];

const spanFilterAIQuery: DSLFilterAIQueryProps = {
  dsl: spanFilterAIQueryDSL,
};

/**
 * Fetches the annotation names that exist on the project's spans and traces so
 * the typeahead can suggest real values rather than made-up examples.
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
            traceAnnotationsNames
          }
        }
      }
    `,
    { id: projectId }
  ).toPromise();
  return [
    ...createAnnotationMemberCompletions({
      accessor: "annotations",
      noun: "annotation",
      sectionName: "Annotations",
      // notes are a pseudo-annotation deliberately hidden from
      // annotation-name surfaces
      names: getNonNoteAnnotationNames(
        data?.project?.spanAnnotationNames ?? []
      ),
    }),
    ...createAnnotationMemberCompletions({
      accessor: "trace_annotations",
      noun: "trace annotation",
      sectionName: "Trace Annotations",
      names: getNonNoteAnnotationNames(
        data?.project?.traceAnnotationsNames ?? []
      ),
    }),
  ];
}

/**
 * The argument handed to `onValidCondition`: the condition that passed
 * validation, plus whether it restricts the result set to root spans, which
 * decides between cumulative and per-span metric columns. `null` when the
 * server did not answer.
 */
export type SpanFilterValidConditionArgs = {
  condition: string;
  selectsRootSpansOnly: boolean | null;
  /**
   * True when this settlement is of the value the field mounted with -- a
   * seeded default or a condition already in the URL -- rather than one
   * applied while the field was on screen. Consumers that persist applied
   * conditions to the URL must skip initial settlements: persisting a tab's
   * default imposes it on the other tab, which defaults differently.
   */
  isInitialSettlement: boolean;
};

export type SpanFilterValidationFailureReason =
  DSLFilterValidationFailureReason;

type SpanFilterConditionFieldProps = {
  /**
   * Callback when the condition is valid
   */
  onValidCondition: (args: SpanFilterValidConditionArgs) => void;
  onValidationFailed?: (reason: SpanFilterValidationFailureReason) => void;
  validationRetryKey?: number;
  placeholder?: string;
};
export function SpanFilterConditionField(props: SpanFilterConditionFieldProps) {
  const {
    onValidCondition,
    onValidationFailed,
    validationRetryKey,
    placeholder = "filter condition (e.x. span_kind == 'LLM')",
  } = props;
  const [isConditionValid, setIsConditionValid] = useState<boolean>(true);
  const filterCondition = useSpanFilterCondition();
  const { setFilterCondition } = useSpanFilterActions();
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
    ({
      condition,
      validationResult,
      isInitialSettlement,
    }: DSLFilterValidConditionArgs<SpanFilterConditionValidation>) => {
      // Only conditions applied while the field was on screen enter the
      // recent-searches history. The mount value is a seeded default or a
      // URL's condition -- recording it would stamp text the user never typed
      // into one of the few history slots on every visit.
      if (!isInitialSettlement) {
        recordValidCondition(condition);
      }
      // A null validation result means the condition was empty, which the
      // field resolves without asking the server. An empty condition restricts
      // nothing, so it is knowably not root-scoped. Otherwise the server's
      // answer passes through as-is, `null` (unanswered) included.
      onValidCondition({
        condition,
        selectsRootSpansOnly: validationResult
          ? validationResult.selectsRootSpansOnly
          : false,
        isInitialSettlement,
      });
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
    <AIQueryDSLFilterField
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
      onValidationFailed={onValidationFailed}
      validationRetryKey={validationRetryKey}
      onValidationStateChange={setIsConditionValid}
      aiQuery={spanFilterAIQuery}
    />
  );
}
