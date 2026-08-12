import { css } from "@emotion/react";
import type { ComponentProps } from "react";
import {
  Suspense,
  useEffect,
  useEffectEvent,
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
import type { ProjectEvaluatorScopePanelSpansQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelSpansQuery.graphql";
import { ProjectEvaluatorScopeFieldGroup } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields";
import {
  getProjectEvaluatorMappingDiagnostics,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
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
  // The run list below the Suspense boundary owns the spans and the run
  // machinery; it hands the header's Test All button the latest run-all
  // closure through this ref and reports readiness through the state.
  const runAllSpansRef = useRef<() => void>(() => {});
  const [canRunAllSpans, setCanRunAllSpans] = useState(false);
  const testAllButton = (
    <Button
      size="S"
      variant="primary"
      leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
      isDisabled={!canRunAllSpans}
      onPress={() => runAllSpansRef.current()}
    >
      Test All
    </Button>
  );
  return (
    <div css={panelCSS}>
      <div css={panelScrollCSS}>
        {props.showScopeFields !== false ? (
          <>
            <Flex direction="column" gap="size-25">
              <Heading level={2}>Scope</Heading>
              <Text color="text-500" size="S">
                {isSessionTarget
                  ? "Choose when this evaluator runs on each session."
                  : "Choose what gets evaluated and how much of it."}
              </Text>
            </Flex>
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
          <SessionInputNote />
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
                  runAllSpansRef={runAllSpansRef}
                  onCanRunAllChange={setCanRunAllSpans}
                />
              ) : (
                <LlmSpanRunList
                  projectId={projectId}
                  filterCondition={scope.filterCondition}
                  timeWindow={timeWindow}
                  requiredVariables={requiredVariables}
                  runAllSpansRef={runAllSpansRef}
                  onCanRunAllChange={setCanRunAllSpans}
                />
              )}
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Sessions have no span-shaped preview, so name the bindings the evaluator will
 * actually receive rather than testing it against a span that it will never see.
 */
function SessionInputNote() {
  return (
    <Flex direction="column" gap="size-25">
      <Heading level={2}>Session input</Heading>
      <Text color="text-500" size="S">
        Your evaluator receives the session transcript as <code>input</code> and
        the last response in the session as <code>output</code>. Testing against
        a recorded session is not available yet.
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
        {scope.targetType === "SESSION" ? null : (
          <Flex direction="column" gap="size-50">
            <Text size="XS" weight="heavy" color="text-700">
              Preview window
            </Text>
            <TimeWindowSegmentedControl
              value={timeWindow.presetId}
              onChange={onTimeWindowChange}
            />
          </Flex>
        )}
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

const scopeEditorCardCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-200);
`;

type SpanRunResult = {
  readonly evaluatorName: string;
  readonly annotation: {
    readonly name: string;
    readonly label: string | null;
    readonly score: number | null;
    readonly explanation: string | null;
  } | null;
  readonly error: string | null;
};

type SpanRun =
  | { status: "running" }
  | { status: "done"; results: SpanRunResult[] }
  | { status: "error"; message: string };

type SpanListRow = {
  key: string;
  name: string;
  spanKind: string;
  context: unknown;
  isSample: boolean;
};

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
  runAllSpansRef,
  onCanRunAllChange,
}: {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
  requiredVariables?: string[];
  /** Receives the latest run-every-loaded-span closure for the header button. */
  runAllSpansRef?: { current: () => void };
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
  const hasMoreSpans = data.project?.spans?.pageInfo.hasNextPage ?? false;
  const sample =
    spans.length === 0 ? getSampleSpanEvaluationContext(filterCondition) : null;
  const rows: SpanListRow[] = spans.length
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
            isSample: true,
          },
        ]
      : [];
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
  // Key the effect on the row key: the row object is rebuilt every render.
  const activeRowKey = activeRow?.key ?? null;
  const syncMappingSource = useEffectEvent(() => {
    const context = activeRow?.context;
    if (context && isSpanEvaluatorMappingSource(context)) {
      evaluatorStore.getState().setEvaluatorMappingSource(context);
    }
  });
  useEffect(() => {
    syncMappingSource();
  }, [activeRowKey]);
  const { runs, runOnSpan, isRunnable } = useEvaluatorPreviewRuns({
    codeEvaluatorId,
    inlineCode,
    playgroundStore,
  });
  // No dependency array: rows and runOnSpan are rebuilt every render, so the
  // ref is refreshed each render to keep the header's Test All button current.
  useEffect(() => {
    if (runAllSpansRef) {
      runAllSpansRef.current = () => {
        for (const row of rows) {
          runOnSpan(row.key, row.context);
        }
      };
    }
  });
  const canRunAllSpans = isRunnable && rows.length > 0;
  useEffect(() => {
    onCanRunAllChange?.(canRunAllSpans);
    return () => onCanRunAllChange?.(false);
  }, [canRunAllSpans, onCanRunAllChange]);
  return (
    <div css={runListCSS}>
      {rows[0]?.isSample ? (
        <Text size="S" color="text-500">
          Use this sample span to test your evaluator.
        </Text>
      ) : null}
      <ul aria-label="Recent matching spans" className="span-run-list__rows">
        {rows.map((row) => (
          <SpanRunRow
            key={row.key}
            row={row}
            isExpanded={expandedRowKey === row.key}
            onToggleExpanded={() =>
              setExpandedKey(expandedRowKey === row.key ? null : row.key)
            }
            run={runs[row.key]}
            isRunnable={isRunnable}
            onRun={() => runOnSpan(row.key, row.context)}
            pathMapping={pathMapping}
            requiredVariables={requiredVariables}
          />
        ))}
      </ul>
      {hasMoreSpans ? (
        <Flex justifyContent="center">
          <LoadMoreButton
            isLoadingNext={isShowingMore}
            onLoadMore={() =>
              startShowMoreTransition(() => {
                setLimit((current) => current + SPAN_LIST_PAGE_SIZE);
              })
            }
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
  .span-run-list__rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
  }
`;

function SpanRunRow({
  row,
  isExpanded,
  onToggleExpanded,
  run,
  isRunnable,
  onRun,
  pathMapping,
  requiredVariables,
}: {
  row: SpanListRow;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  run: SpanRun | undefined;
  isRunnable: boolean;
  onRun: () => void;
  pathMapping: Record<string, string>;
  requiredVariables?: string[];
}) {
  const isRunning = run?.status === "running";
  return (
    <li>
      <Card
        collapsible
        isOpen={isExpanded}
        onOpenChange={onToggleExpanded}
        title={
          <>
            <SpanKindToken spanKind={row.spanKind} size="S" />
            {row.name}
          </>
        }
        titleExtra={row.isSample ? <Token size="S">sample</Token> : null}
        headerContent={
          <CardCollapsedPreview>
            {getContextSnippet(row.context)}
          </CardCollapsedPreview>
        }
        extra={
          <Flex direction="row" alignItems="center" gap="size-100" flex="none">
            <SpanRunResultChip run={run} />
            <Button
              size="S"
              variant="primary"
              aria-label={
                // Recent spans commonly share a name; suffix the span id so
                // each row's button has a distinct accessible name.
                row.isSample
                  ? `Test evaluator on ${row.name}`
                  : `Test evaluator on ${row.name}, span ${row.key.slice(-8)}`
              }
              leadingVisual={
                <Icon
                  svg={isRunning ? <Icons.Loading /> : <Icons.PlayCircle />}
                />
              }
              isDisabled={!isRunnable || isRunning}
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
            <Flex direction="column" gap="size-100">
              <SpanRunDetail run={run} />
              <Tabs defaultSelectedKey="bindings">
                <TabList>
                  <Tab id="bindings">Bindings</Tab>
                  <Tab id="context">Context</Tab>
                </TabList>
                <TabPanel id="bindings">
                  <BindingPreview
                    context={row.context}
                    pathMapping={pathMapping}
                    requiredVariables={requiredVariables}
                    isSampleContext={row.isSample}
                  />
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
function SpanRunResultChip({ run }: { run: SpanRun | undefined }) {
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
function SpanRunDetail({ run }: { run: SpanRun | undefined }) {
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
  /** Set only for explicit path mappings. */
  path?: string;
  value: unknown;
};

function BindingPreview({
  context,
  pathMapping,
  requiredVariables,
  isSampleContext,
}: {
  context: unknown;
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
  const automaticRows: BindingRow[] = diagnostics
    .filter(
      ({ variable, status }) =>
        status === "resolved" && !(variable in pathMapping)
    )
    .map(({ variable, path }) => ({
      keyword: variable,
      value: getValueAtPath(context, path),
    }));
  const mappedRows: BindingRow[] = diagnostics
    .filter(
      ({ variable, status }) => status === "resolved" && variable in pathMapping
    )
    .map(({ variable, path }) => ({
      keyword: variable,
      path,
      value: getValueAtPath(context, path),
    }));
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);
  return (
    <Flex direction="column" gap="size-50" marginTop="size-100">
      {isSampleContext ? (
        <Alert variant="info" title="Bindings use a sample span">
          Verify the bindings against a real span once matching spans exist.
        </Alert>
      ) : null}
      {[...automaticRows, ...mappedRows].map((row) => (
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
      {variables.length === 0 ? (
        <Text size="S" color="text-500">
          This evaluator declares no recognizable inputs.
        </Text>
      ) : null}
      {diagnostics.map(({ variable, path, status }) =>
        status === "missing" ? (
          <Alert
            key={variable}
            variant="danger"
            title={`${variable} does not resolve`}
          >
            No value at {path} on this span.
          </Alert>
        ) : status === "unverified" ? (
          <Alert
            key={variable}
            variant="warning"
            title={`${variable} is unverified`}
          >
            {path} is checked by the server when the evaluator runs.
          </Alert>
        ) : status === "optional-missing" ? (
          <Text key={variable} size="S" color="text-500">
            <code>{variable}</code> is optional and is not present on this span.
          </Text>
        ) : null
      )}
    </Flex>
  );
}

function BindingPreviewRow({
  row,
  isExpanded,
  onToggleExpanded,
}: {
  row: BindingRow;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}) {
  const isTextValue = typeof row.value === "string";
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
        <code className="binding-row__keyword">{row.keyword}</code>
        {row.path ? (
          <code className="binding-row__path">← {row.path}</code>
        ) : null}
        {isExpanded ? null : (
          <span className="binding-row__value">
            {getBoundValueSnippet(row.value)}
          </span>
        )}
      </button>
      {isExpanded ? (
        <div className="binding-row__detail">
          {isTextValue ? (
            <pre className="binding-row__text">{String(row.value)}</pre>
          ) : (
            <JSONBlock
              value={JSON.stringify(row.value, null, 2) ?? "undefined"}
              basicSetup={{ lineNumbers: false }}
            />
          )}
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
  .binding-row__value {
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

function getBoundValueSnippet(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  return toContentPreview(value, { maxLength: 120 }) ?? "";
}

function isSpanEvaluatorMappingSource(
  value: unknown
): value is EvaluatorMappingSource<"span"> {
  // Only `metadata` is guaranteed to be an object by the server context shape;
  // `input`/`output` are raw attribute values.
  return isStringKeyedObject(value) && isStringKeyedObject(value.metadata);
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
  const [runs, setRuns] = useState<Record<string, SpanRun>>({});
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

  const runOnSpan = (spanKey: string, spanContext: unknown) => {
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
    setRuns((current) => ({ ...current, [spanKey]: { status: "running" } }));
    previewEvaluator({
      variables: {
        input: {
          previews: [
            {
              context: spanContext,
              evaluator,
              inputMapping: state.evaluator.inputMapping,
            },
          ],
          credentials: toGqlCredentials(credentials),
        },
      },
      onCompleted(response, errors) {
        if (errors?.length) {
          setRuns((current) => ({
            ...current,
            [spanKey]: {
              status: "error",
              message: errors.map(({ message }) => message).join("\n"),
            },
          }));
          return;
        }
        setRuns((current) => ({
          ...current,
          [spanKey]: {
            status: "done",
            results: [...response.evaluatorPreviews.results],
          },
        }));
      },
      onError(mutationError) {
        setRuns((current) => ({
          ...current,
          [spanKey]: {
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

  return { runs, runOnSpan, isRunnable };
}
