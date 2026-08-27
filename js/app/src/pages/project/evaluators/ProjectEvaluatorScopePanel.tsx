import { css } from "@emotion/react";
import type { ComponentProps, ReactNode } from "react";
import {
  Suspense,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  Card,
  CardCollapsedPreview,
  Flex,
  Heading,
  Icon,
  Icons,
  Loading,
  LoadMoreButton,
  SegmentedControl,
  SegmentedControlItem,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  Token,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import {
  AnnotationPreviewCard,
  AnnotationPreviewPopoverButton,
  AnnotationPreviewSkeletonCard,
} from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import {
  EVALUATOR_SLOT_NAMES,
  getEvaluatorSlotDefault,
  type EvaluatorSlotName,
} from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import {
  buildOutputConfigsInput,
  createLLMEvaluatorPayload,
  getOutputConfigValidationErrors,
} from "@phoenix/components/evaluators/utils";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import type { ProjectEvaluatorScopePanelCountQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelCountQuery.graphql";
import type {
  InlineCodeEvaluatorInput,
  InlineLLMEvaluatorInput,
  ProjectEvaluatorScopePanelPreviewMutation,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelPreviewMutation.graphql";
import type { ProjectEvaluatorScopePanelSessionCountQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelSessionCountQuery.graphql";
import type { ProjectEvaluatorScopePanelSessionsQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelSessionsQuery.graphql";
import type { ProjectEvaluatorScopePanelSpansQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelSpansQuery.graphql";
import { getEvaluatorBoundVariables } from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import { toBoundValueDisplay } from "@phoenix/pages/project/evaluators/ProjectEvaluatorBoundVariables";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import {
  dropOtherGrainEntityPathMappings,
  getProjectEvaluatorMappingDiagnostics,
  toEvaluatorMappingSourceGrain,
  type ProjectEvaluatorMappingSourceGrain,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  getGenericSessionEvaluationContext,
  getSampleSessionEvaluationContext,
} from "@phoenix/pages/project/evaluators/sampleSessionEvaluationContext";
import {
  getGenericSpanEvaluationContext,
  getSampleSpanEvaluationContext,
} from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { toContentPreview } from "@phoenix/utils/contentPreviewUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";
import { getValueAtPath } from "@phoenix/utils/objectUtils";

export type ProjectEvaluatorInlineCode = {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  sandboxConfigId: string | null;
};

const TIME_WINDOW_PRESETS = [
  {
    id: "1h",
    label: "Last hour",
    shortLabel: "1h",
    prose: "in the last hour",
    ms: 3_600_000,
  },
  {
    id: "24h",
    label: "Last 24 hours",
    shortLabel: "24h",
    prose: "in the last 24 hours",
    ms: 86_400_000,
  },
  {
    id: "7d",
    label: "Last 7 days",
    shortLabel: "7d",
    prose: "in the last 7 days",
    ms: 7 * 86_400_000,
  },
  {
    id: "30d",
    label: "Last 30 days",
    shortLabel: "30d",
    prose: "in the last 30 days",
    ms: 30 * 86_400_000,
  },
] as const;

const isTimeWindowPresetId = (value: string): value is TimeWindowPresetId =>
  TIME_WINDOW_PRESETS.some(({ id }) => id === value);

type TimeWindowPresetId = (typeof TIME_WINDOW_PRESETS)[number]["id"];

/**
 * `startIso` is computed once when the preset is chosen so re-renders do not
 * shift the window and refire the queries.
 */
type TimeWindow = {
  presetId: TimeWindowPresetId;
  prose: string;
  startIso: string;
};

function makeTimeWindow(presetId: TimeWindowPresetId): TimeWindow {
  const preset = TIME_WINDOW_PRESETS.find(({ id }) => id === presetId);
  invariant(preset, `unknown time window preset: ${presetId}`);
  return {
    presetId,
    prose: preset.prose,
    startIso: new Date(Date.now() - preset.ms).toISOString(),
  };
}

type ProjectEvaluatorScopePanelScopeFieldsProps =
  | {
      /** Target, sampling, and the span filter render in this panel. */
      showScopeFields?: true;
      onScopeChange: (scope: ProjectEvaluatorScope) => void;
      onFilterValidityChange?: (isValid: boolean) => void;
      isTargetDisabled?: boolean;
    }
  | {
      /**
       * The scope fields render in the definition panel instead; the panel
       * starts at the matching-span preview and edits no scope.
       */
      showScopeFields: false;
    };

/** Scope is committed by the form's create/save action, not by this panel. */
export const ProjectEvaluatorScopePanel = (
  props: {
    projectId: string;
    scope: ProjectEvaluatorScope;
    codeEvaluatorId?: string;
    inlineCode?: ProjectEvaluatorInlineCode;
    requiredVariables?: string[];
  } & ProjectEvaluatorScopePanelScopeFieldsProps
) => {
  const { projectId, scope, codeEvaluatorId, inlineCode, requiredVariables } =
    props;
  const [timeWindow, setTimeWindow] = useState(() => makeTimeWindow("7d"));
  const isSessionTarget = scope.targetType === "SESSION";
  // Span and session contexts are structurally identical, so the store cannot
  // infer the grain from one; changing the target has to say so.
  const evaluatorStore = useEvaluatorStoreInstance();
  const mappingSourceGrain = toEvaluatorMappingSourceGrain(scope.targetType);
  useEffect(() => {
    const state = evaluatorStore.getState();
    state.setEvaluatorMappingSourceGrain(mappingSourceGrain);
    // A path written against the previous kind of record names a root the new
    // one does not have, and a path that matches nothing fails the evaluation.
    const { pathMapping } = dropOtherGrainEntityPathMappings(
      state.evaluator.inputMapping,
      mappingSourceGrain
    );
    state.setPathMapping(pathMapping);
  }, [evaluatorStore, mappingSourceGrain]);
  // The run list below the Suspense boundary owns the records and the run
  // machinery; it hands the header's Test All button the latest run-all
  // closure through this ref and reports readiness through the state.
  const runAllRecordsRef = useRef<() => void>(() => {});
  const [canRunAllRecords, setCanRunAllRecords] = useState(false);
  const testAllButton = (
    <Button
      size="S"
      variant="primary"
      leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
      isDisabled={!canRunAllRecords}
      onPress={() => runAllRecordsRef.current()}
    >
      Test All
    </Button>
  );
  return (
    <div css={panelCSS}>
      <div css={panelScrollCSS}>
        {props.showScopeFields !== false ? (
          <>
            <Heading level={2}>Scope</Heading>
            <ScopeEditorCard
              projectId={projectId}
              scope={scope}
              onScopeChange={props.onScopeChange}
              onFilterValidityChange={props.onFilterValidityChange}
              timeWindow={timeWindow}
              onTimeWindowChange={setTimeWindow}
              isTargetDisabled={props.isTargetDisabled ?? false}
            />
          </>
        ) : null}
        {isSessionTarget ? (
          <>
            <SessionInputNote />
            <Flex direction="column" gap="size-25">
              {props.showScopeFields !== false ? (
                <Flex
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap="size-200"
                >
                  <Heading level={2}>Matching sessions</Heading>
                  {testAllButton}
                </Flex>
              ) : (
                <>
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    gap="size-200"
                  >
                    <Heading level={2} weight="heavy">
                      Test with a Session
                    </Heading>
                    <Flex direction="row" alignItems="center" gap="size-100">
                      <TimeWindowSegmentedControl
                        size="S"
                        value={timeWindow.presetId}
                        onChange={setTimeWindow}
                      />
                      {testAllButton}
                    </Flex>
                  </Flex>
                  <Text color="text-500">
                    Test your evaluator on recent sessions that match your
                    scope.
                  </Text>
                </>
              )}
              <Suspense
                fallback={
                  <Text size="S" color="text-500">
                    Counting matching sessions…
                  </Text>
                }
              >
                <MatchedSessionCountLine
                  projectId={projectId}
                  filterCondition={scope.filterCondition}
                  timeWindow={timeWindow}
                />
              </Suspense>
            </Flex>
            <Suspense fallback={<Loading />}>
              {codeEvaluatorId || inlineCode ? (
                <SessionRunList
                  projectId={projectId}
                  filterCondition={scope.filterCondition}
                  timeWindow={timeWindow}
                  codeEvaluatorId={codeEvaluatorId}
                  inlineCode={inlineCode}
                  requiredVariables={requiredVariables}
                  runAllRecordsRef={runAllRecordsRef}
                  onCanRunAllChange={setCanRunAllRecords}
                />
              ) : (
                <LlmSessionRunList
                  projectId={projectId}
                  filterCondition={scope.filterCondition}
                  timeWindow={timeWindow}
                  requiredVariables={requiredVariables}
                  runAllRecordsRef={runAllRecordsRef}
                  onCanRunAllChange={setCanRunAllRecords}
                />
              )}
            </Suspense>
          </>
        ) : (
          <>
            <Flex direction="column" gap="size-25">
              {props.showScopeFields !== false ? (
                <Flex
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap="size-200"
                >
                  <Heading level={2}>Matching spans</Heading>
                  {testAllButton}
                </Flex>
              ) : (
                <>
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    gap="size-200"
                  >
                    <Heading level={2} weight="heavy">
                      Test with a Span
                    </Heading>
                    <Flex direction="row" alignItems="center" gap="size-100">
                      <TimeWindowSegmentedControl
                        size="S"
                        value={timeWindow.presetId}
                        onChange={setTimeWindow}
                      />
                      {testAllButton}
                    </Flex>
                  </Flex>
                  <Text color="text-500">
                    Test your evaluator on recent spans that match your scope.
                  </Text>
                </>
              )}
              <Suspense
                fallback={
                  <Text size="S" color="text-500">
                    Counting matching spans…
                  </Text>
                }
              >
                <MatchedSpanCountLine
                  projectId={projectId}
                  filterCondition={scope.filterCondition}
                  timeWindow={timeWindow}
                />
              </Suspense>
            </Flex>
            <Suspense fallback={<Loading />}>
              {codeEvaluatorId || inlineCode ? (
                <SpanRunList
                  projectId={projectId}
                  filterCondition={scope.filterCondition}
                  timeWindow={timeWindow}
                  codeEvaluatorId={codeEvaluatorId}
                  inlineCode={inlineCode}
                  requiredVariables={requiredVariables}
                  runAllRecordsRef={runAllRecordsRef}
                  onCanRunAllChange={setCanRunAllRecords}
                />
              ) : (
                <LlmSpanRunList
                  projectId={projectId}
                  filterCondition={scope.filterCondition}
                  timeWindow={timeWindow}
                  requiredVariables={requiredVariables}
                  runAllRecordsRef={runAllRecordsRef}
                  onCanRunAllChange={setCanRunAllRecords}
                />
              )}
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
};

/** Names the bindings a session evaluator receives, which no span vocabulary covers. */
function SessionInputNote() {
  return (
    <Flex direction="column" gap="size-25">
      <Heading level={2}>Session input</Heading>
      <Text color="text-500" size="S">
        The session's first input as <code>input</code>, its last output as{" "}
        <code>output</code>, and every turn under{" "}
        <code>metadata.session.turns</code>.
      </Text>
    </Flex>
  );
}

const panelCSS = css`
  display: flex;
  flex-direction: column;
  min-height: 100%;
`;

const panelScrollCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
  padding: 0 var(--global-dimension-size-200) var(--global-dimension-size-200);
`;

function useMatchedSpanCount({
  projectId,
  filterCondition,
  startIso,
}: {
  projectId: string;
  filterCondition: string;
  startIso: string;
}) {
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelCountQuery>(
    graphql`
      query ProjectEvaluatorScopePanelCountQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $filterCondition: String
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spanCountTimeSeries(
              timeRange: $timeRange
              filterCondition: $filterCondition
            ) {
              data {
                totalCount
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      timeRange: { start: startIso },
      filterCondition: filterCondition.trim() || null,
    },
    { fetchPolicy: "store-and-network" }
  );
  return (
    data.project?.spanCountTimeSeries?.data.reduce(
      (total, point) => total + (point.totalCount ?? 0),
      0
    ) ?? 0
  );
}

function TimeWindowSegmentedControl({
  value,
  onChange,
  size,
}: {
  value: TimeWindowPresetId;
  onChange: (timeWindow: TimeWindow) => void;
  size?: ComponentProps<typeof SegmentedControl>["size"];
}) {
  return (
    <SegmentedControl
      aria-label="Preview window"
      size={size}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (typeof key === "string" && isTimeWindowPresetId(key)) {
          onChange(makeTimeWindow(key));
        }
      }}
    >
      {TIME_WINDOW_PRESETS.map((preset) => (
        <SegmentedControlItem
          key={preset.id}
          id={preset.id}
          aria-label={preset.label}
        >
          {preset.shortLabel}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function ScopeEditorCard({
  projectId,
  scope,
  onScopeChange,
  onFilterValidityChange,
  timeWindow,
  onTimeWindowChange,
  isTargetDisabled,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onFilterValidityChange?: (isValid: boolean) => void;
  timeWindow: TimeWindow;
  onTimeWindowChange: (timeWindow: TimeWindow) => void;
  isTargetDisabled: boolean;
}) {
  return (
    <div css={scopeEditorCardCSS}>
      <ProjectEvaluatorScopeFieldGroup
        projectId={projectId}
        scope={scope}
        onScopeChange={onScopeChange}
        onFilterValidityChange={onFilterValidityChange}
        isTargetDisabled={isTargetDisabled}
      >
        <Flex direction="column" gap="size-50">
          <Text size="XS" weight="heavy" color="text-700">
            Preview window
          </Text>
          <TimeWindowSegmentedControl
            value={timeWindow.presetId}
            onChange={onTimeWindowChange}
          />
        </Flex>
      </ProjectEvaluatorScopeFieldGroup>
    </div>
  );
}

function MatchedSpanCountLine({
  projectId,
  filterCondition,
  timeWindow,
}: {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
}) {
  const { startIso, prose } = timeWindow;
  const matchedCount = useMatchedSpanCount({
    projectId,
    filterCondition,
    startIso,
  });
  const hasMatches = matchedCount > 0;
  return (
    <Text size="S" color="text-500">
      {hasMatches
        ? `${matchedCount.toLocaleString()} span${matchedCount === 1 ? "" : "s"} matched ${prose}. The most recent are shown below.`
        : `No spans matched this scope ${prose}.`}
    </Text>
  );
}

function MatchedSessionCountLine({
  projectId,
  filterCondition,
  timeWindow,
}: {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
}) {
  const { startIso, prose } = timeWindow;
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelSessionCountQuery>(
    graphql`
      query ProjectEvaluatorScopePanelSessionCountQuery(
        $projectId: ID!
        $timeRange: TimeRange!
        $sessionFilterCondition: String
      ) {
        project: node(id: $projectId) {
          ... on Project {
            sessionCount(
              timeRange: $timeRange
              sessionFilterCondition: $sessionFilterCondition
            )
          }
        }
      }
    `,
    {
      projectId,
      timeRange: { start: startIso },
      sessionFilterCondition: filterCondition.trim() || null,
    },
    { fetchPolicy: "store-and-network" }
  );
  const matchedCount = data.project?.sessionCount ?? 0;
  const hasMatches = matchedCount > 0;
  return (
    <Text size="S" color="text-500">
      {hasMatches
        ? `${matchedCount.toLocaleString()} session${matchedCount === 1 ? "" : "s"} matched ${prose}. The most recent are shown below.`
        : `No sessions matched this scope ${prose}.`}
    </Text>
  );
}

const SESSION_LIST_PAGE_SIZE = 5;

function formatSessionMetric(numTraces: number, totalTokens: number): string {
  const traces = `${numTraces.toLocaleString()} trace${numTraces === 1 ? "" : "s"}`;
  return `${traces} · ${totalTokens.toLocaleString()} tokens`;
}

function LlmSessionRunList(
  props: Omit<
    Parameters<typeof SessionRunList>[0],
    "codeEvaluatorId" | "inlineCode" | "playgroundStore"
  >
) {
  const playgroundStore = usePlaygroundStore();
  return <SessionRunList {...props} playgroundStore={playgroundStore} />;
}

/**
 * The sessions this evaluator would run on, each carrying the same evaluation
 * context a live session evaluation binds against, so a row can be tested.
 */
function SessionRunList({
  projectId,
  filterCondition,
  timeWindow,
  codeEvaluatorId,
  inlineCode,
  playgroundStore,
  requiredVariables,
  runAllRecordsRef,
  onCanRunAllChange,
}: {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
  requiredVariables?: string[];
  runAllRecordsRef?: { current: () => void };
  onCanRunAllChange?: (canRunAll: boolean) => void;
}) {
  const [limit, setLimit] = useState(SESSION_LIST_PAGE_SIZE);
  // A transition keeps the current rows visible instead of collapsing the list
  // to its Suspense fallback while the wider page loads.
  const [isShowingMore, startShowMoreTransition] = useTransition();
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelSessionsQuery>(
    graphql`
      query ProjectEvaluatorScopePanelSessionsQuery(
        $projectId: ID!
        $sessionFilterCondition: String
        $timeRange: TimeRange
        $first: Int!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            sessions(
              first: $first
              sort: { col: startTime, dir: desc }
              sessionFilterCondition: $sessionFilterCondition
              timeRange: $timeRange
            ) {
              edges {
                session: node {
                  id
                  sessionId
                  numTraces
                  tokenUsage {
                    total
                  }
                  sessionEvaluationContext
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      sessionFilterCondition: filterCondition.trim() || null,
      timeRange: { start: timeWindow.startIso },
      first: limit,
    },
    { fetchPolicy: "store-and-network" }
  );
  const sessions = data.project?.sessions?.edges.map(({ session }) => session);
  const sample = sessions?.length ? null : getSampleSessionEvaluationContext();
  const rows: RecordedRunListRow[] = sessions?.length
    ? sessions.map((session) => ({
        key: session.id,
        name: session.sessionId,
        context: session.sessionEvaluationContext,
        isSample: false,
        unavailableReason:
          session.sessionEvaluationContext == null
            ? "This session has no evaluable transcript."
            : undefined,
        metric: formatSessionMetric(
          session.numTraces,
          session.tokenUsage.total
        ),
      }))
    : sample
      ? [
          {
            key: SAMPLE_ROW_KEY,
            name: "Sample session",
            context: sample.context,
            mappingContext: getGenericSessionEvaluationContext().context,
            isSample: true,
          },
        ]
      : [];
  return (
    <RecordedRunList
      rows={rows}
      recordNoun="session"
      listLabel="Recent matching sessions"
      hasMore={data.project?.sessions?.pageInfo.hasNextPage ?? false}
      isLoadingMore={isShowingMore}
      onLoadMore={() =>
        startShowMoreTransition(() => {
          setLimit((current) => current + SESSION_LIST_PAGE_SIZE);
        })
      }
      codeEvaluatorId={codeEvaluatorId}
      inlineCode={inlineCode}
      playgroundStore={playgroundStore}
      requiredVariables={requiredVariables}
      runAllRecordsRef={runAllRecordsRef}
      onCanRunAllChange={onCanRunAllChange}
    />
  );
}

const scopeEditorCardCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-200);
`;

type RecordedRunResult = {
  readonly evaluatorName: string;
  readonly annotation: {
    readonly name: string;
    readonly label: string | null;
    readonly score: number | null;
    readonly explanation: string | null;
  } | null;
  readonly error: string | null;
};

type RecordedRun =
  | { status: "running" }
  | { status: "done"; results: RecordedRunResult[] }
  | { status: "error"; message: string };

/** One recorded span or session, with the context an evaluator binds against. */
type RecordedRunListRow = {
  key: string;
  name: string;
  /** Prefixes the card title on a span row; a session has no kind. */
  spanKind?: string;
  context: unknown;
  /**
   * What authoring builds against instead of `context`. A sample row sets this
   * to the grain's generic no-values skeleton so completion and the bindings
   * list read the schema, never the invented demo data.
   */
  mappingContext?: unknown;
  isSample: boolean;
  /** An at-a-glance measure of the record, such as a session's trace count. */
  metric?: string;
  /**
   * Why this record has no context to bind against. Set only when the server
   * cannot produce one, in which case a live evaluation would fail the same way.
   */
  unavailableReason?: string;
};

/** Names the kind of record a row holds, for prose and accessible labels. */
type RecordedRunNoun = "span" | "session";

const SAMPLE_ROW_KEY = "__sample__";

const SPAN_LIST_PAGE_SIZE = 5;

function LlmSpanRunList(
  props: Omit<
    Parameters<typeof SpanRunList>[0],
    "codeEvaluatorId" | "inlineCode" | "playgroundStore"
  >
) {
  const playgroundStore = usePlaygroundStore();
  return <SpanRunList {...props} playgroundStore={playgroundStore} />;
}

function SpanRunList({
  projectId,
  filterCondition,
  timeWindow,
  codeEvaluatorId,
  inlineCode,
  playgroundStore,
  requiredVariables,
  runAllRecordsRef,
  onCanRunAllChange,
}: {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
  requiredVariables?: string[];
  runAllRecordsRef?: { current: () => void };
  onCanRunAllChange?: (canRunAll: boolean) => void;
}) {
  const [limit, setLimit] = useState(SPAN_LIST_PAGE_SIZE);
  // A transition keeps the current rows visible instead of collapsing the list
  // to its Suspense fallback while the wider page loads.
  const [isShowingMore, startShowMoreTransition] = useTransition();
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelSpansQuery>(
    graphql`
      query ProjectEvaluatorScopePanelSpansQuery(
        $projectId: ID!
        $filterCondition: String
        $timeRange: TimeRange
        $first: Int!
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spans(
              first: $first
              sort: { col: startTime, dir: desc }
              filterCondition: $filterCondition
              timeRange: $timeRange
            ) {
              edges {
                span: node {
                  id
                  name
                  spanKind
                  evaluationContext
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      filterCondition: filterCondition.trim() || null,
      timeRange: { start: timeWindow.startIso },
      first: limit,
    },
    { fetchPolicy: "store-and-network" }
  );
  const spans = data.project?.spans?.edges.map(({ span }) => span) ?? [];
  const sample =
    spans.length === 0 ? getSampleSpanEvaluationContext(filterCondition) : null;
  const rows: RecordedRunListRow[] = spans.length
    ? spans.map((span) => ({
        key: span.id,
        name: span.name,
        spanKind: span.spanKind,
        context: span.evaluationContext,
        isSample: false,
      }))
    : sample
      ? [
          {
            key: SAMPLE_ROW_KEY,
            name: `Sample ${sample.spanKind} span`,
            spanKind: sample.spanKind.toLowerCase(),
            context: sample.context,
            mappingContext: getGenericSpanEvaluationContext().context,
            isSample: true,
          },
        ]
      : [];
  return (
    <RecordedRunList
      rows={rows}
      recordNoun="span"
      listLabel="Recent matching spans"
      hasMore={data.project?.spans?.pageInfo.hasNextPage ?? false}
      isLoadingMore={isShowingMore}
      onLoadMore={() =>
        startShowMoreTransition(() => {
          setLimit((current) => current + SPAN_LIST_PAGE_SIZE);
        })
      }
      codeEvaluatorId={codeEvaluatorId}
      inlineCode={inlineCode}
      playgroundStore={playgroundStore}
      requiredVariables={requiredVariables}
      runAllRecordsRef={runAllRecordsRef}
      onCanRunAllChange={onCanRunAllChange}
    />
  );
}

/**
 * The recorded records an evaluator can be tested against. The active row is the
 * mapping source, so the input mapping is authored against a real context.
 */
function RecordedRunList({
  rows,
  recordNoun,
  listLabel,
  hasMore,
  isLoadingMore,
  onLoadMore,
  codeEvaluatorId,
  inlineCode,
  playgroundStore,
  requiredVariables,
  runAllRecordsRef,
  onCanRunAllChange,
}: {
  rows: RecordedRunListRow[];
  recordNoun: RecordedRunNoun;
  listLabel: string;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
  requiredVariables?: string[];
  /** Receives the latest run-every-loaded-record closure for the header button. */
  runAllRecordsRef?: { current: () => void };
  onCanRunAllChange?: (canRunAll: boolean) => void;
}) {
  // `undefined` is no explicit choice yet (the newest row opens); `null` is an
  // explicit collapse-all.
  const [expandedKey, setExpandedKey] = useState<string | null | undefined>(
    undefined
  );
  const expandedRowKey =
    expandedKey === null
      ? null
      : expandedKey != null && rows.some(({ key }) => key === expandedKey)
        ? expandedKey
        : (rows[0]?.key ?? null);
  const activeRow = rows.find(({ key }) => key === expandedRowKey) ?? rows[0];
  const evaluatorStore = useEvaluatorStoreInstance();
  const pathMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  // The row object is rebuilt every render, and a session keeps its key while
  // its context changes under it — a refresh, a preview-window change, or a
  // load-more can all return a new transcript for the same row. Key the effect
  // on what the context says, so the mapping source follows the value the Run
  // actually sends rather than the one the row opened with.
  const activeRowKey = activeRow?.key ?? null;
  const activeRowContext = activeRow?.context;
  const activeRowContextIdentity = useMemo(
    () => (activeRowContext == null ? null : JSON.stringify(activeRowContext)),
    [activeRowContext]
  );
  const syncMappingSource = useEffectEvent(() => {
    const context = activeRow?.mappingContext ?? activeRow?.context;
    if (context && hasEvaluatorMappingSourceShape(context)) {
      evaluatorStore.getState().setEvaluatorMappingSource(context);
    }
  });
  useEffect(() => {
    syncMappingSource();
  }, [activeRowKey, activeRowContextIdentity]);
  const { runs, runOnContext, isRunnable } = useEvaluatorPreviewRuns({
    codeEvaluatorId,
    inlineCode,
    playgroundStore,
  });
  // A row the server could not build a context for would bind against nothing.
  const runnableRows = rows.filter(
    ({ unavailableReason }) => !unavailableReason
  );
  // No dependency array: rows and runOnContext are rebuilt every render, so the
  // ref is refreshed each render to keep the header's Test All button current.
  useEffect(() => {
    if (runAllRecordsRef) {
      runAllRecordsRef.current = () => {
        for (const row of runnableRows) {
          runOnContext(row.key, row.context);
        }
      };
    }
  });
  const canRunAllRecords = isRunnable && runnableRows.length > 0;
  useEffect(() => {
    onCanRunAllChange?.(canRunAllRecords);
    return () => onCanRunAllChange?.(false);
  }, [canRunAllRecords, onCanRunAllChange]);
  return (
    <div css={runListCSS}>
      {rows[0]?.isSample ? (
        <Text size="S" color="text-500">
          Use this sample {recordNoun} to test your evaluator.
        </Text>
      ) : null}
      <ul aria-label={listLabel} className="run-list__rows">
        {rows.map((row) => (
          <RecordedRunRow
            key={row.key}
            row={row}
            recordNoun={recordNoun}
            isExpanded={expandedRowKey === row.key}
            onToggleExpanded={() =>
              setExpandedKey(expandedRowKey === row.key ? null : row.key)
            }
            run={runs[row.key]}
            isRunnable={isRunnable}
            onRun={() => runOnContext(row.key, row.context)}
            pathMapping={pathMapping}
            requiredVariables={requiredVariables}
          />
        ))}
      </ul>
      {hasMore ? (
        <Flex justifyContent="center">
          <LoadMoreButton
            isLoadingNext={isLoadingMore}
            onLoadMore={onLoadMore}
          />
        </Flex>
      ) : null}
    </div>
  );
}

const runListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  .run-list__rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
  }
`;

function RecordedRunRow({
  row,
  recordNoun,
  isExpanded,
  onToggleExpanded,
  run,
  isRunnable,
  onRun,
  pathMapping,
  requiredVariables,
}: {
  row: RecordedRunListRow;
  recordNoun: RecordedRunNoun;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  run: RecordedRun | undefined;
  isRunnable: boolean;
  onRun: () => void;
  pathMapping: Record<string, string>;
  requiredVariables?: string[];
}) {
  const isRunning = run?.status === "running";
  const isUnavailable = row.unavailableReason != null;
  return (
    <li>
      <Card
        collapsible
        isOpen={isExpanded}
        onOpenChange={onToggleExpanded}
        title={
          <>
            {row.spanKind ? (
              <SpanKindToken spanKind={row.spanKind} size="S" />
            ) : null}
            {row.name}
          </>
        }
        titleExtra={
          row.isSample ? (
            <Token size="S">sample</Token>
          ) : row.metric ? (
            <Token size="S">{row.metric}</Token>
          ) : null
        }
        headerContent={
          <CardCollapsedPreview>
            {getContextSnippet(row.context)}
          </CardCollapsedPreview>
        }
        extra={
          <Flex direction="row" alignItems="center" gap="size-100" flex="none">
            <RecordedRunResultChip run={run} />
            <Button
              size="S"
              variant="primary"
              aria-label={
                // Recent records commonly share a name; suffix the record id so
                // each row's button has a distinct accessible name.
                row.isSample
                  ? `Test evaluator on ${row.name}`
                  : `Test evaluator on ${row.name}, ${recordNoun} ${row.key.slice(-8)}`
              }
              leadingVisual={
                <Icon
                  svg={isRunning ? <Icons.Loading /> : <Icons.PlayCircle />}
                />
              }
              isDisabled={!isRunnable || isRunning || isUnavailable}
              isPending={isRunning}
              onPress={onRun}
            >
              {isRunning ? "Testing..." : "Test"}
            </Button>
          </Flex>
        }
      >
        {isExpanded ? (
          <View padding="size-200">
            {row.unavailableReason ? (
              <Alert variant="warning" title="No evaluation context">
                {row.unavailableReason}
              </Alert>
            ) : (
              <Flex direction="column" gap="size-100">
                <RecordedRunDetail run={run} />
                <Tabs defaultSelectedKey="values">
                  <TabList>
                    <Tab id="values">Values</Tab>
                    <Tab id="context">Context</Tab>
                  </TabList>
                  <TabPanel id="values">
                    <Flex direction="column" gap="size-200">
                      <BindingPreview
                        context={row.mappingContext ?? row.context}
                        recordNoun={recordNoun}
                        pathMapping={pathMapping}
                        requiredVariables={requiredVariables}
                        isSampleContext={row.isSample}
                      />
                    </Flex>
                  </TabPanel>
                  <TabPanel id="context">
                    <div css={contextViewerCSS}>
                      <JSONBlock
                        value={JSON.stringify(row.context, null, 2)}
                        basicSetup={{ lineNumbers: false }}
                      />
                    </div>
                  </TabPanel>
                </Tabs>
              </Flex>
            )}
          </View>
        ) : null}
      </Card>
    </li>
  );
}

/**
 * The collapsed-row result summary: the same annotation button and details
 * popover the dataset evaluator's test panel renders.
 */
function RecordedRunResultChip({ run }: { run: RecordedRun | undefined }) {
  if (run == null || run.status === "running") {
    return null;
  }
  const annotated =
    run.status === "done"
      ? run.results.find((result) => result.annotation != null)
      : null;
  if (annotated?.annotation) {
    return (
      <div css={resultAnnotationCSS}>
        <AnnotationPreviewPopoverButton
          annotation={annotated.annotation}
          compact
        />
      </div>
    );
  }
  const hasFailure =
    run.status === "error" || run.results.some((result) => result.error);
  return hasFailure ? (
    <Token size="S" color="var(--global-color-danger)">
      failed
    </Token>
  ) : null;
}

/**
 * ExperimentAnnotationButton is inline-size contained (intrinsic width 0), so
 * a shrink-wrapping flex item would collapse it; give it a definite width.
 */
const resultAnnotationCSS = css`
  flex: 0 1 auto;
  min-width: 0;
  max-width: 280px;
`;

/**
 * The expanded-row result: the dataset evaluator's "Evaluator Annotation
 * Preview" card, with the same skeleton while a test is in flight.
 */
function RecordedRunDetail({ run }: { run: RecordedRun | undefined }) {
  if (run == null) {
    return null;
  }
  if (run.status === "running") {
    return <AnnotationPreviewSkeletonCard />;
  }
  if (run.status === "error") {
    return (
      <Alert variant="danger" title="Evaluator Error">
        {run.message}
      </Alert>
    );
  }
  return (
    <Flex direction="column" gap="size-100">
      {run.results.map((result, index) =>
        result.error ? (
          <Alert
            key={index}
            variant="danger"
            title={`Evaluator Error: ${result.evaluatorName}`}
          >
            {result.error}
          </Alert>
        ) : result.annotation ? (
          <AnnotationPreviewCard key={index} annotation={result.annotation} />
        ) : null
      )}
    </Flex>
  );
}

const contextViewerCSS = css`
  margin-top: var(--global-dimension-size-100);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  /* CodeMirror only virtualizes long documents when it scrolls inside a
     bounded height. */
  .cm-editor {
    max-height: 400px;
  }
  .cm-scroller {
    overflow: auto;
  }
`;

type BindingRow = {
  keyword: string;
  /** The path the value is read from; every binding has one. */
  path?: string;
  /** One line on the name, shown on hover. */
  description?: string;
  /** Stands in for the value until a record supplies one. */
  typeHint?: string;
  value: unknown;
};

function BindingPreview({
  context,
  recordNoun,
  pathMapping,
  requiredVariables,
  isSampleContext,
}: {
  context: unknown;
  recordNoun: RecordedRunNoun;
  pathMapping: Record<string, string>;
  requiredVariables?: string[];
  isSampleContext: boolean;
}) {
  const declaredVariables = useEvaluatorInputVariables();
  const variables =
    declaredVariables.length === 0 && isStringKeyedObject(context)
      ? Object.keys(context)
      : declaredVariables;
  const diagnostics = getProjectEvaluatorMappingDiagnostics({
    context,
    pathMapping,
    variables,
    requiredVariables,
  });
  const grain = recordNoun === "session" ? "session" : "span";
  // The canonical slots always lead, each reflecting the mapping in force: an
  // explicit path when one is set, the slot's default otherwise.
  const slotRows: BindingRow[] = EVALUATOR_SLOT_NAMES.map((slotName) => {
    const path =
      pathMapping[slotName] || getEvaluatorSlotDefault(grain, slotName).path;
    return { keyword: slotName, path, value: getValueAtPath(context, path) };
  });
  const mappedRows: BindingRow[] = diagnostics
    .filter(
      ({ status, source, variable }) =>
        status === "resolved" &&
        source === "path" &&
        !EVALUATOR_SLOT_NAMES.includes(variable as EvaluatorSlotName)
    )
    .map((diagnostic) => ({
      keyword: diagnostic.variable,
      path: diagnostic.path,
      value: getValueAtPath(context, diagnostic.path),
    }));
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);
  const toggle = (keyword: string) =>
    setExpandedKeyword((current) => (current === keyword ? null : keyword));
  return (
    <Flex direction="column" gap="size-50" marginTop="size-100">
      {isSampleContext ? (
        <Alert variant="info" title={`Standard ${recordNoun} fields`}>
          Values fill in once this project has a {recordNoun} that matches.
        </Alert>
      ) : null}
      {[...slotRows, ...mappedRows].map((row) =>
        row.keyword === METADATA_SLOT_NAME ? (
          <BindingPreviewRow
            key={row.keyword}
            row={row}
            isExpanded={expandedKeyword === row.keyword}
            onToggleExpanded={() => toggle(row.keyword)}
          >
            <MetadataBindingTree value={row.value} grain={grain} />
          </BindingPreviewRow>
        ) : (
          <BindingPreviewRow
            key={row.keyword}
            row={row}
            isExpanded={expandedKeyword === row.keyword}
            onToggleExpanded={() => toggle(row.keyword)}
          />
        )
      )}

      {diagnostics.map(({ variable, path, status, source }) =>
        status === "missing" ? (
          <Alert
            key={variable}
            variant="danger"
            title={`${variable} would fail on this ${recordNoun}`}
          >
            {source === "path"
              ? `Nothing matches ${path}, so the evaluation stops with an error instead of writing an annotation.`
              : `This ${recordNoun} offers no ${variable}, so the evaluation stops with an error instead of writing an annotation.`}
          </Alert>
        ) : status === "unverified" ? (
          <Alert
            key={variable}
            variant="warning"
            title={`${variable} is unverified`}
          >
            {path} is checked by the server when the evaluator runs.
          </Alert>
        ) : null
      )}
    </Flex>
  );
}

const METADATA_SLOT_NAME = "metadata";

/**
 * What `metadata` holds, in reading order: the record's own names first — the
 * ones a filter condition already uses — then the whole record, collapsed,
 * because it is the one branch nobody reads top to bottom.
 */
function MetadataBindingTree({
  value,
  grain,
}: {
  value: unknown;
  grain: ProjectEvaluatorMappingSourceGrain;
}) {
  const metadata = isStringKeyedObject(value) ? value : {};
  const hasRecordValues = Object.values(metadata).some(
    (entry) => entry != null && !isStringKeyedObject(entry)
  );
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);
  const rows: BindingRow[] = getEvaluatorBoundVariables(grain).map(
    ({ name, type, description }) => ({
      keyword: name,
      description,
      typeHint: hasRecordValues ? undefined : type,
      value: metadata[name],
    })
  );
  return (
    <Flex direction="column" gap="size-50">
      {[...rows, { keyword: grain, value: metadata[grain] }].map((row) => (
        <BindingPreviewRow
          key={row.keyword}
          row={row}
          isExpanded={expandedKeyword === row.keyword}
          onToggleExpanded={() =>
            setExpandedKeyword((current) =>
              current === row.keyword ? null : row.keyword
            )
          }
        />
      ))}
    </Flex>
  );
}

/** A value a single line cannot show whole earns the expand affordance. */
function isExpandableBindingValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.length > 80;
  }
  return typeof value === "object" && value !== null;
}

function BindingPreviewRow({
  row,
  isExpanded,
  onToggleExpanded,
  children,
}: {
  row: BindingRow;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  /** Rendered in place of the raw value when the row opens onto a tree. */
  children?: ReactNode;
}) {
  const isTextValue = typeof row.value === "string";
  const isExpandable = children != null || isExpandableBindingValue(row.value);
  const display = toBoundValueDisplay(row.value);
  const annotation = row.path ? (
    <code className="binding-row__path">← {row.path}</code>
  ) : null;
  const head = (
    <>
      <code className="binding-row__keyword" title={row.description}>
        {row.keyword}
      </code>
      {annotation}
      {isExpandable && isExpanded ? null : (
        <span className="binding-row__value" title={display.exact}>
          {display.text ?? row.typeHint ?? "—"}
        </span>
      )}
    </>
  );
  if (!isExpandable) {
    return (
      <div css={bindingRowCSS}>
        <div className="binding-row__toggle binding-row__toggle--static">
          <span className="binding-row__chevron-spacer" />
          {head}
        </div>
      </div>
    );
  }
  return (
    <div css={bindingRowCSS} data-expanded={isExpanded}>
      <button
        type="button"
        className="binding-row__toggle"
        aria-expanded={isExpanded}
        onClick={onToggleExpanded}
      >
        <Icon
          svg={isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
        />
        {head}
      </button>
      {isExpanded ? (
        <div className="binding-row__detail">
          {children ??
            (isTextValue ? (
              <pre className="binding-row__text">{String(row.value)}</pre>
            ) : (
              <JSONBlock
                value={JSON.stringify(row.value, null, 2) ?? "undefined"}
                basicSetup={{ lineNumbers: false }}
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}

const bindingRowCSS = css`
  border: 1px solid transparent;
  border-radius: var(--global-rounding-small);
  &[data-expanded="true"] {
    border-color: var(--global-border-color-default);
  }
  .binding-row__toggle {
    box-sizing: border-box;
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-50) var(--global-dimension-size-75);
    border: none;
    border-radius: var(--global-rounding-small);
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--global-text-color-500);
    &:hover {
      background-color: rgba(var(--global-color-gray-500-rgb), 0.15);
    }
    &:focus-visible {
      outline: 2px solid var(--global-color-info);
      outline-offset: 1px;
    }
  }
  .binding-row__keyword {
    flex: none;
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    color: var(--global-text-color-900);
  }
  .binding-row__path {
    flex: none;
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
  .binding-row__toggle--static {
    cursor: default;
  }
  .binding-row__chevron-spacer {
    display: inline-block;
    width: var(--global-dimension-size-200);
    flex: none;
  }
  .binding-row__value {
    margin-left: auto;
    text-align: right;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
  }
  .binding-row__detail {
    border-top: 1px solid var(--global-border-color-default);
    padding: var(--global-dimension-size-75);
    max-height: 240px;
    overflow: auto;
  }
  .binding-row__text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
  }
`;

/**
 * The collapsed-card excerpt for a span: the span's input, falling back to its
 * output. An LLM span's input often arrives as a serialized chat payload, so
 * surface the latest message's text rather than the raw JSON envelope.
 */
function getContextSnippet(context: unknown): string {
  if (!isStringKeyedObject(context)) {
    return "";
  }
  return (
    toContentPreview(getLatestMessageText(context.input) ?? context.input) ??
    toContentPreview(getLatestMessageText(context.output) ?? context.output) ??
    ""
  );
}

/** The text of the last non-empty message in a chat payload, if it is one. */
function getLatestMessageText(value: unknown): string | null {
  const payload =
    typeof value === "string" && value.trimStart().startsWith("{")
      ? safelyParseJSON(value).json
      : value;
  if (!isStringKeyedObject(payload) || !Array.isArray(payload.messages)) {
    return null;
  }
  for (let index = payload.messages.length - 1; index >= 0; index--) {
    const message: unknown = payload.messages[index];
    const content = isStringKeyedObject(message) ? message.content : null;
    if (typeof content === "string" && content.trim()) {
      return content;
    }
  }
  return null;
}

/**
 * Span and session contexts share this shape, so this cannot tell them apart —
 * the store's grain does. Only `metadata` is guaranteed to be an object by the
 * server context shape; `input`/`output` are raw attribute values.
 */
function hasEvaluatorMappingSourceShape(
  value: unknown
): value is EvaluatorMappingSource<"span" | "session"> {
  if (!isStringKeyedObject(value) || !isStringKeyedObject(value.metadata)) {
    return false;
  }
  const { metadata } = value;
  return (
    isStringKeyedObject(metadata.span) || isStringKeyedObject(metadata.session)
  );
}

function useEvaluatorPreviewRuns({
  codeEvaluatorId,
  inlineCode,
  playgroundStore,
}: {
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
}) {
  const evaluatorStore = useEvaluatorStoreInstance();
  const credentials = useCredentialsContext((state) => state);
  const [runs, setRuns] = useState<Record<string, RecordedRun>>({});
  const [previewEvaluator] =
    useMutation<ProjectEvaluatorScopePanelPreviewMutation>(graphql`
      mutation ProjectEvaluatorScopePanelPreviewMutation(
        $input: EvaluatorPreviewsInput!
      ) {
        evaluatorPreviews(input: $input) {
          results {
            evaluatorName
            annotation {
              name
              label
              score
              explanation
            }
            error
          }
        }
      }
    `);
  const outputConfigs = useEvaluatorStore((state) => state.outputConfigs);
  const isRunnable =
    codeEvaluatorId != null ||
    inlineCode != null ||
    getOutputConfigValidationErrors(outputConfigs).length === 0;

  const runOnContext = (rowKey: string, context: unknown) => {
    const state = evaluatorStore.getState();
    let evaluator:
      | { codeEvaluatorId: string }
      | { inlineCodeEvaluator: InlineCodeEvaluatorInput }
      | { inlineLlmEvaluator: InlineLLMEvaluatorInput };
    if (codeEvaluatorId) {
      evaluator = { codeEvaluatorId };
    } else if (inlineCode) {
      evaluator = {
        inlineCodeEvaluator: {
          name: state.evaluator.globalName,
          language: inlineCode.language,
          sourceCode: inlineCode.sourceCode,
          outputConfigs: buildOutputConfigsInput(state.outputConfigs),
          sandboxConfigId: inlineCode.sandboxConfigId,
          description: state.evaluator.description || null,
        },
      };
    } else {
      invariant(playgroundStore, "a playground store is required");
      const { instances } = playgroundStore.getState();
      const instance = instances[0];
      invariant(instance != null, "a playground instance is required");
      const instanceId = instance.id;
      invariant(instanceId != null, "instanceId is required");
      const payload = createLLMEvaluatorPayload({
        playgroundStore,
        instanceId,
        name: state.evaluator.globalName,
        description: state.evaluator.description,
        outputConfigs: state.outputConfigs,
        inputMapping: state.evaluator.inputMapping,
        includeExplanation: state.evaluator.includeExplanation,
        datasetId: "",
      });
      evaluator = {
        inlineLlmEvaluator: {
          name: payload.name,
          description: payload.description,
          outputConfigs: payload.outputConfigs,
          promptVersion: payload.promptVersion,
        },
      };
    }
    setRuns((current) => ({ ...current, [rowKey]: { status: "running" } }));
    previewEvaluator({
      variables: {
        input: {
          previews: [
            {
              context,
              evaluator,
              inputMapping: state.evaluator.inputMapping,
              // Every row here stands in for a scheduled run, span or
              // session, so the run has to fail wherever the live one would.
              applyOnlineEvaluationLimits: true,
            },
          ],
          credentials: toGqlCredentials(credentials),
        },
      },
      onCompleted(response, errors) {
        if (errors?.length) {
          setRuns((current) => ({
            ...current,
            [rowKey]: {
              status: "error",
              message: errors.map(({ message }) => message).join("\n"),
            },
          }));
          return;
        }
        setRuns((current) => ({
          ...current,
          [rowKey]: {
            status: "done",
            results: [...response.evaluatorPreviews.results],
          },
        }));
      },
      onError(mutationError) {
        setRuns((current) => ({
          ...current,
          [rowKey]: {
            status: "error",
            message:
              getErrorMessagesFromRelayMutationError(mutationError)?.join(
                "\n"
              ) ?? mutationError.message,
          },
        }));
      },
    });
  };

  return { runs, runOnContext, isRunnable };
}
