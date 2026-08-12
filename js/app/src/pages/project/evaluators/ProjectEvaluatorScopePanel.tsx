import { css } from "@emotion/react";
import {
  Suspense,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  ListBox,
  Loading,
  LoadMoreButton,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Slider,
  SliderNumberField,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/core/disclosure";
import { EvaluatorCategoricalChoiceConfig } from "@phoenix/components/evaluators/EvaluatorCategoricalChoiceConfig";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import {
  buildOutputConfigsInput,
  computePositiveOptimization,
  createLLMEvaluatorPayload,
  getOutputConfigValidationErrors,
} from "@phoenix/components/evaluators/utils";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import type { ProjectEvaluatorScopePanelCountQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelCountQuery.graphql";
import type {
  InlineCodeEvaluatorInput,
  InlineLLMEvaluatorInput,
  ProjectEvaluatorScopePanelPreviewMutation,
} from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelPreviewMutation.graphql";
import type { ProjectEvaluatorScopePanelSpansQuery } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorScopePanelSpansQuery.graphql";
import { ProjectEvaluatorTargetField } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTargetField";
import {
  getProjectEvaluatorMappingDiagnostics,
  type ProjectEvaluatorScope,
  toProjectEvaluatorSamplingFraction,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import {
  SpanFilterConditionFieldCore,
  type SpanFilterValidConditionArgs,
} from "@phoenix/pages/project/SpanFilterConditionField";
import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { getValueAtPath } from "@phoenix/utils/objectUtils";

export type ProjectEvaluatorInlineCode = {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
  sandboxConfigId: string | null;
};

const TIME_WINDOW_PRESETS = [
  { id: "1h", label: "Last hour", prose: "in the last hour", ms: 3_600_000 },
  {
    id: "24h",
    label: "Last 24 hours",
    prose: "in the last 24 hours",
    ms: 86_400_000,
  },
  {
    id: "7d",
    label: "Last 7 days",
    prose: "in the last 7 days",
    ms: 7 * 86_400_000,
  },
  {
    id: "30d",
    label: "Last 30 days",
    prose: "in the last 30 days",
    ms: 30 * 86_400_000,
  },
  { id: "all", label: "All time", prose: "all time", ms: null },
] as const;

type TimeWindowPresetId = (typeof TIME_WINDOW_PRESETS)[number]["id"];

/**
 * `startIso` is computed once when the preset is chosen so re-renders do not
 * shift the window and refire the queries.
 */
type TimeWindow = {
  presetId: TimeWindowPresetId;
  prose: string;
  startIso: string | null;
};

function makeTimeWindow(presetId: TimeWindowPresetId): TimeWindow {
  const preset = TIME_WINDOW_PRESETS.find(({ id }) => id === presetId);
  invariant(preset, `unknown time window preset: ${presetId}`);
  return {
    presetId,
    prose: preset.prose,
    startIso:
      preset.ms == null ? null : new Date(Date.now() - preset.ms).toISOString(),
  };
}

/** Scope is committed by the form's create/save action, not by this panel. */
export const ProjectEvaluatorScopePanel = ({
  projectId,
  scope,
  onScopeChange,
  onFilterValidityChange,
  codeEvaluatorId,
  inlineCode,
  requiredVariables,
  showAnnotationTemplate = false,
  isTargetDisabled = false,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onFilterValidityChange?: (isValid: boolean) => void;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  requiredVariables?: string[];
  showAnnotationTemplate?: boolean;
  isTargetDisabled?: boolean;
}) => {
  const [timeWindow, setTimeWindow] = useState(() => makeTimeWindow("7d"));
  return (
    <div css={panelCSS}>
      <div css={panelScrollCSS}>
        <Flex direction="column" gap="size-25">
          <Heading level={2}>Scope</Heading>
          <Text color="text-500" size="S">
            Select which spans this evaluator runs on and how often.
          </Text>
        </Flex>
        <ScopeEditorCard
          projectId={projectId}
          scope={scope}
          onScopeChange={onScopeChange}
          onFilterValidityChange={onFilterValidityChange}
          timeWindow={timeWindow}
          onTimeWindowChange={setTimeWindow}
          isTargetDisabled={isTargetDisabled}
        />
        <Flex direction="column" gap="size-25">
          <Heading level={2}>Matching spans</Heading>
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
            />
          ) : (
            <LlmSpanRunList
              projectId={projectId}
              filterCondition={scope.filterCondition}
              timeWindow={timeWindow}
              requiredVariables={requiredVariables}
            />
          )}
        </Suspense>
        {showAnnotationTemplate ? <AnnotationTemplateDisclosure /> : null}
      </div>
    </div>
  );
};

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

/** Bounded windows only — an all-time count is an unbounded bucket scan. */
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
  // Only validated conditions are lifted into `scope`.
  const [filterConditionDraft, setFilterConditionDraft] = useState(
    scope.filterCondition
  );
  const handleValidCondition = ({
    condition: filterCondition,
  }: SpanFilterValidConditionArgs) => {
    if (filterCondition === scope.filterCondition) {
      return;
    }
    onScopeChange({ ...scope, filterCondition });
  };
  return (
    <div css={scopeEditorCardCSS}>
      <Flex direction="column" gap="size-200">
        <Flex direction="row" gap="size-400" wrap alignItems="start">
          <ProjectEvaluatorTargetField
            value={scope.targetType}
            onChange={(targetType) => onScopeChange({ ...scope, targetType })}
            isDisabled={isTargetDisabled}
          />
          <Flex direction="column" gap="size-50">
            <Text size="XS" weight="heavy" color="text-700">
              Sampling
            </Text>
            <Slider
              aria-label="Sampling rate"
              css={samplingSliderCSS}
              minValue={0}
              maxValue={100}
              step={1}
              value={Math.round(scope.samplingRate * 100)}
              onChange={(samplingRatePercent) =>
                onScopeChange({
                  ...scope,
                  samplingRate:
                    toProjectEvaluatorSamplingFraction(samplingRatePercent),
                })
              }
              thumbLabels={["Sampling rate percentage"]}
            >
              <SliderNumberField
                aria-label="Sampling rate percentage"
                formatOptions={{
                  style: "unit",
                  unit: "percent",
                  unitDisplay: "narrow",
                }}
              />
            </Slider>
          </Flex>
          <Flex direction="column" gap="size-50">
            <Text size="XS" weight="heavy" color="text-700">
              Preview window
            </Text>
            <Select
              value={timeWindow.presetId}
              onChange={(presetId) =>
                onTimeWindowChange(
                  makeTimeWindow(presetId as TimeWindowPresetId)
                )
              }
              aria-label="Preview window"
              css={css`
                width: 160px;
              `}
            >
              <Button>
                <SelectValue />
                <SelectChevronUpDownIcon />
              </Button>
              <Popover>
                <ListBox>
                  {TIME_WINDOW_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} id={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </ListBox>
              </Popover>
            </Select>
          </Flex>
        </Flex>
        <Flex direction="column" gap="size-50">
          <Text size="XS" weight="heavy" color="text-700">
            Span filter
          </Text>
          <SpanFilterConditionFieldCore
            projectId={projectId}
            filterCondition={filterConditionDraft}
            onFilterConditionChange={setFilterConditionDraft}
            onValidCondition={handleValidCondition}
            onValidityChange={onFilterValidityChange}
            placeholder="span_kind == 'LLM'"
          />
          <Text size="XS" color="text-500">
            Leave empty to evaluate every span.
          </Text>
        </Flex>
      </Flex>
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
  if (timeWindow.startIso == null) {
    return (
      <Text size="S" color="text-500">
        The most recent spans that match this scope.
      </Text>
    );
  }
  return (
    <BoundedMatchedSpanCountLine
      projectId={projectId}
      filterCondition={filterCondition}
      startIso={timeWindow.startIso}
      prose={timeWindow.prose}
    />
  );
}

function BoundedMatchedSpanCountLine({
  projectId,
  filterCondition,
  startIso,
  prose,
}: {
  projectId: string;
  filterCondition: string;
  startIso: string;
  prose: string;
}) {
  const matchedCount = useMatchedSpanCount({
    projectId,
    filterCondition,
    startIso,
  });
  const hasMatches = matchedCount > 0;
  return (
    <Text size="S" color={hasMatches ? "success" : "text-500"}>
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

const samplingSliderCSS = css`
  grid-template-areas: "track output";
  grid-template-columns: 1fr auto;
  align-items: center;
  /* Match the specificity of the base component's orientation rule, which
     otherwise wins with width: 100% and collapses the track. */
  &[data-orientation="horizontal"] {
    width: 220px;
    height: var(--global-input-height-m);
  }
  .slider__output {
    display: flex;
    align-items: center;
    min-height: 0;
  }
  /* The base slider styles this input under an orientation-qualified selector;
     restate that qualification so these later, equal-specificity rules win. */
  &[data-orientation="horizontal"] .slider__number-field .react-aria-Input {
    margin-bottom: 0;
    height: var(--global-input-height-m);
  }
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
  startTime: string | null;
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
}: {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
  playgroundStore?: ReturnType<typeof usePlaygroundStore>;
  requiredVariables?: string[];
}) {
  const { shortDateTimeFormatter } = useTimeFormatters();
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
                  startTime
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
      timeRange:
        timeWindow.startIso == null ? null : { start: timeWindow.startIso },
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
        startTime: span.startTime,
        context: span.evaluationContext,
        isSample: false,
      }))
    : sample
      ? [
          {
            key: SAMPLE_ROW_KEY,
            name: `Sample ${sample.spanKind} span`,
            startTime: null,
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
            isMappingSource={activeRow?.key === row.key}
            onToggleExpanded={() =>
              setExpandedKey(expandedRowKey === row.key ? null : row.key)
            }
            run={runs[row.key]}
            isRunnable={isRunnable}
            onRun={() => runOnSpan(row.key, row.context)}
            pathMapping={pathMapping}
            requiredVariables={requiredVariables}
            formattedTime={
              row.startTime
                ? shortDateTimeFormatter(new Date(row.startTime))
                : null
            }
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
    gap: var(--global-dimension-size-25);
  }
`;

function SpanRunRow({
  row,
  isExpanded,
  isMappingSource,
  onToggleExpanded,
  run,
  isRunnable,
  onRun,
  pathMapping,
  requiredVariables,
  formattedTime,
}: {
  row: SpanListRow;
  isExpanded: boolean;
  isMappingSource: boolean;
  onToggleExpanded: () => void;
  run: SpanRun | undefined;
  isRunnable: boolean;
  onRun: () => void;
  pathMapping: Record<string, string>;
  requiredVariables?: string[];
  formattedTime: string | null;
}) {
  const isRunning = run?.status === "running";
  return (
    <li
      css={runRowCSS}
      data-expanded={isExpanded}
      aria-current={isMappingSource ? "true" : undefined}
    >
      <div className="span-run-row__header">
        <button
          type="button"
          className="span-run-row__toggle"
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
        >
          <Icon
            svg={isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
          />
          <span className="span-run-row__name">{row.name}</span>
          {row.isSample ? (
            <span className="span-run-row__badge">Sample</span>
          ) : null}
          {isMappingSource ? (
            <span className="span-run-row__badge">Mapping source</span>
          ) : null}
          <span className="span-run-row__snippet">
            {getContextSnippet(row.context)}
          </span>
          {formattedTime ? (
            <span className="span-run-row__time">{formattedTime}</span>
          ) : null}
        </button>
        <SpanRunResultChip run={run} />
        <Button
          size="S"
          aria-label={`Run evaluator on ${row.name}, ${
            formattedTime ?? `span ${row.key.slice(-8)}`
          }`}
          leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
          isDisabled={!isRunnable || isRunning}
          isPending={isRunning}
          onPress={onRun}
        />
      </div>
      {isExpanded ? (
        <div className="span-run-row__detail">
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
        </div>
      ) : null}
    </li>
  );
}

const runRowCSS = css`
  border: 1px solid transparent;
  border-radius: var(--global-rounding-small);
  &[aria-current="true"] {
    border-color: var(--global-color-info);
  }
  &[data-expanded="true"] {
    border-color: var(--global-border-color-default);
    background-color: var(--global-color-gray-100);
  }
  .span-run-row__header {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    padding-right: var(--global-dimension-size-75);
  }
  .span-run-row__toggle {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-75) var(--global-dimension-size-100);
    border: none;
    border-radius: var(--global-rounding-small);
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--global-text-color-700);
    &:hover {
      background-color: rgba(var(--global-color-gray-500-rgb), 0.15);
    }
    &:focus-visible {
      outline: 2px solid var(--global-color-info);
      outline-offset: 1px;
    }
  }
  .span-run-row__name {
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    flex: none;
    color: var(--global-text-color-900);
  }
  .span-run-row__badge {
    flex: none;
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--global-text-color-500);
    border: 1px solid var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
    padding: 0 var(--global-dimension-size-75);
  }
  .span-run-row__snippet {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
  .span-run-row__time {
    flex: none;
    font-variant-numeric: tabular-nums;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
  .span-run-row__detail {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-100);
    border-top: 1px solid var(--global-border-color-default);
  }
`;

function SpanRunResultChip({ run }: { run: SpanRun | undefined }) {
  const outputConfigs = useEvaluatorStore((state) => state.outputConfigs);
  const evaluatorName = useEvaluatorStore(
    (state) => state.evaluator.name || state.evaluator.globalName
  );
  if (run == null || run.status === "running") {
    return null;
  }
  if (run.status === "error") {
    return <span css={[resultChipCSS, resultChipDangerCSS]}>failed</span>;
  }
  const failed = run.results.filter((result) => result.error);
  const annotated = run.results.find((result) => result.annotation != null);
  if (annotated?.annotation) {
    const { annotation } = annotated;
    const positiveOptimization = computePositiveOptimization({
      annotationName: annotation.name,
      score: annotation.score,
      evaluatorName,
      outputConfigs,
    });
    const valueParts = [
      annotation.label,
      annotation.score != null ? annotation.score.toLocaleString() : null,
    ].filter((part): part is string => part != null);
    return (
      <span
        css={resultChipCSS}
        data-direction={
          positiveOptimization == null
            ? undefined
            : positiveOptimization
              ? "positive"
              : "negative"
        }
        title={annotation.explanation ?? undefined}
      >
        {annotation.name}
        {valueParts.length ? ` · ${valueParts.join(" · ")}` : ""}
      </span>
    );
  }
  if (failed.length) {
    return <span css={[resultChipCSS, resultChipDangerCSS]}>failed</span>;
  }
  return null;
}

const resultChipCSS = css`
  flex: none;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--global-font-family-code, monospace);
  font-size: var(--global-font-size-xs);
  font-weight: 600;
  color: var(--global-text-color-700);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-25) var(--global-dimension-size-100);
  &[data-direction="positive"] {
    color: var(--global-color-optimization-direction-positive);
    background-color: var(
      --global-color-background-optimization-direction-positive
    );
  }
  &[data-direction="negative"] {
    color: var(--global-color-optimization-direction-negative);
    background-color: var(
      --global-color-background-optimization-direction-negative
    );
  }
`;

const resultChipDangerCSS = css`
  color: var(--global-color-danger);
`;

function SpanRunDetail({ run }: { run: SpanRun | undefined }) {
  if (run == null || run.status === "running") {
    return null;
  }
  if (run.status === "error") {
    return (
      <Alert variant="danger" title="Test failed">
        {run.message}
      </Alert>
    );
  }
  return (
    <Flex direction="column" gap="size-75">
      {run.results.map((result, index) =>
        result.error ? (
          <Alert
            key={index}
            variant="danger"
            title={`${result.evaluatorName} failed`}
          >
            {result.error}
          </Alert>
        ) : result.annotation?.explanation ? (
          <Text key={index} size="S" color="text-700">
            {result.annotation.explanation}
          </Text>
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

function getContextSnippet(context: unknown): string {
  if (!isStringKeyedObject(context)) {
    return "";
  }
  const input = context.input;
  const text =
    typeof input === "string"
      ? input
      : input != null
        ? JSON.stringify(input)
        : "";
  return text.replace(/\s+/g, " ").trim().slice(0, 140);
}

function getBoundValueSnippet(value: unknown): string {
  if (value === undefined) {
    return "";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
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

function AnnotationTemplateDisclosure() {
  const isCategorical = useEvaluatorStore((state) => {
    const outputConfig = state.outputConfigs[0];
    return outputConfig != null && "values" in outputConfig;
  });
  if (!isCategorical) {
    return null;
  }
  return (
    <Disclosure
      id="annotation-template"
      defaultExpanded
      css={annotationTemplateDisclosureCSS}
    >
      <DisclosureTrigger direction="column" alignItems="start" width="100%">
        <Heading level={2}>Annotation template</Heading>
        <Text color="text-500">
          Define the annotation that your evaluator will attach to matched
          spans.
        </Text>
      </DisclosureTrigger>
      <DisclosurePanel>
        <View padding="size-200">
          <EvaluatorCategoricalChoiceConfig />
        </View>
      </DisclosurePanel>
    </Disclosure>
  );
}

/**
 * A standalone disclosure trigger shrinks to fit its text; widen it so the
 * whole card header is the click target.
 */
const annotationTemplateDisclosureCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  .react-aria-Heading {
    width: 100%;
  }
  [slot="trigger"] {
    width: 100%;
    padding: var(--global-dimension-size-200);
    border-bottom: none;
    /* Inset by the card's 1px border so the hover background stays inside its
       corners. */
    border-radius: calc(var(--global-rounding-medium) - 1px);
  }
  &[data-expanded="true"] [slot="trigger"] {
    border-bottom: 1px solid var(--global-border-color-default);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;
