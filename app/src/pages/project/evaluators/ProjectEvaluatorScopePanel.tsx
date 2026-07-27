import { css } from "@emotion/react";
import { Suspense, useEffect, useEffectEvent, useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import invariant from "tiny-invariant";

import {
  Alert,
  Button,
  Empty,
  Flex,
  Heading,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  Loading,
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
import {
  buildOutputConfigsInput,
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
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import { SpanFilterConditionFieldCore } from "@phoenix/pages/project/SpanFilterConditionField";
import type {
  CodeEvaluatorLanguage,
  EvaluatorMappingSource,
} from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";
import { getValueAtPath } from "@phoenix/utils/objectUtils";

/**
 * The unsaved source code being authored, used to preview a not-yet-created
 * code evaluator via the inline-code preview path.
 */
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
 * The preview window applied to the matched-span count and span list. The
 * start is computed once when the preset is chosen so re-renders do not shift
 * the window and refire the queries.
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

/**
 * The right-column scope panel for a project evaluator: a prose scope summary
 * (or its in-place edit state), the recent matching spans it implies — each
 * row expandable to the span's evaluation context and keyword bindings, and
 * runnable against the evaluator being authored — and, for LLM evaluators,
 * the annotation template the evaluator will attach.
 */
export const ProjectEvaluatorScopePanel = ({
  projectId,
  scope,
  onScopeChange,
  onFilterValidityChange,
  mode = "create",
  codeEvaluatorId,
  inlineCode,
  showAnnotationTemplate = false,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onFilterValidityChange?: (isValid: boolean) => void;
  /** "create" opens with the scope editor expanded; "edit" opens committed. */
  mode?: "create" | "edit";
  /** Set when testing an existing CODE evaluator. */
  codeEvaluatorId?: string;
  /** Set when testing not-yet-created code. */
  inlineCode?: ProjectEvaluatorInlineCode;
  /** Renders the LLM annotation template section below the span list. */
  showAnnotationTemplate?: boolean;
}) => {
  const [isEditingScope, setIsEditingScope] = useState(mode === "create");
  const [timeWindow, setTimeWindow] = useState(() => makeTimeWindow("7d"));
  return (
    <div css={panelCSS}>
      <div css={panelScrollCSS}>
        <Flex direction="column" gap="size-25">
          <Heading level={2}>Scope</Heading>
          <Text color="text-500" size="S">
            Which spans run this evaluator, and how often. These spans are used
            to test your evaluator, and you can change them later.
          </Text>
        </Flex>
        {isEditingScope ? (
          <ScopeEditorCard
            projectId={projectId}
            scope={scope}
            onScopeChange={onScopeChange}
            onFilterValidityChange={onFilterValidityChange}
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
            onDone={() => setIsEditingScope(false)}
          />
        ) : (
          <ScopeSummaryBar
            projectId={projectId}
            scope={scope}
            timeWindow={timeWindow}
            onModify={() => setIsEditingScope(true)}
          />
        )}
        <Suspense fallback={<Loading />}>
          <SpanRunList
            projectId={projectId}
            filterCondition={scope.filterCondition}
            timeWindow={timeWindow}
            codeEvaluatorId={codeEvaluatorId}
            inlineCode={inlineCode}
          />
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

/**
 * Counts spans matching the committed filter inside the preview window.
 * Bounded windows only — an all-time bucket scan is unbounded server work.
 */
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

/**
 * The committed scope, stated as one sentence — sampling, filter, and how
 * many recent spans it matches — with the single action that reopens editing.
 */
function ScopeSummaryBar({
  projectId,
  scope,
  timeWindow,
  onModify,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  timeWindow: TimeWindow;
  onModify: () => void;
}) {
  return (
    <div css={summaryBarCSS}>
      <span className="scope-summary__sentence">
        {scope.samplingRatePercent}% of spans
        {scope.filterCondition ? (
          <>
            {" where "}
            <code className="scope-summary__filter">
              {scope.filterCondition}
            </code>
          </>
        ) : null}{" "}
        <Suspense fallback={<span>(counting…)</span>}>
          <MatchedSpanCountParenthetical
            projectId={projectId}
            filterCondition={scope.filterCondition}
            timeWindow={timeWindow}
          />
        </Suspense>
      </span>
      <Button size="S" onPress={onModify}>
        Modify
      </Button>
    </div>
  );
}

function MatchedSpanCountParenthetical({
  projectId,
  filterCondition,
  timeWindow,
}: {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
}) {
  if (timeWindow.startIso == null) {
    return <span>(all time)</span>;
  }
  return (
    <BoundedMatchedSpanCountParenthetical
      projectId={projectId}
      filterCondition={filterCondition}
      startIso={timeWindow.startIso}
      prose={timeWindow.prose}
    />
  );
}

function BoundedMatchedSpanCountParenthetical({
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
  return (
    <span>
      ({matchedCount.toLocaleString()} {prose})
    </span>
  );
}

const summaryBarCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-150);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-color-gray-200);
  .scope-summary__sentence {
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--global-font-size-s);
    color: var(--global-text-color-900);
  }
  .scope-summary__filter {
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    color: var(--global-color-info);
  }
`;

/**
 * The scope's edit state, expanded in place of the summary bar: target,
 * sampling, filter, and preview window, with the live matched count. Done
 * commits back to the one-sentence summary.
 */
function ScopeEditorCard({
  projectId,
  scope,
  onScopeChange,
  onFilterValidityChange,
  timeWindow,
  onTimeWindowChange,
  onDone,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  onFilterValidityChange?: (isValid: boolean) => void;
  timeWindow: TimeWindow;
  onTimeWindowChange: (timeWindow: TimeWindow) => void;
  onDone: () => void;
}) {
  // The editor's live text; only validated conditions are lifted into `scope`.
  const [filterConditionDraft, setFilterConditionDraft] = useState(
    scope.filterCondition
  );
  const [isFilterValid, setIsFilterValid] = useState(true);
  const handleValidCondition = (filterCondition: string) => {
    if (filterCondition === scope.filterCondition) {
      return;
    }
    onScopeChange({ ...scope, filterCondition });
  };
  const handleValidityChange = (isValid: boolean) => {
    setIsFilterValid(isValid);
    onFilterValidityChange?.(isValid);
  };
  return (
    <div css={scopeEditorCardCSS}>
      <Flex direction="column" gap="size-200">
        <Flex direction="row" gap="size-400" wrap alignItems="start">
          <ProjectEvaluatorTargetField
            value={scope.targetType}
            onChange={(targetType) => onScopeChange({ ...scope, targetType })}
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
              value={scope.samplingRatePercent}
              onChange={(samplingRatePercent) =>
                onScopeChange({ ...scope, samplingRatePercent })
              }
              thumbLabels={["Sampling rate percentage"]}
            >
              <SliderNumberField aria-label="Sampling rate percentage">
                <Input />
              </SliderNumberField>
              <Text color="text-500">%</Text>
            </Slider>
          </Flex>
          <Select
            value={timeWindow.presetId}
            onChange={(presetId) =>
              onTimeWindowChange(makeTimeWindow(presetId as TimeWindowPresetId))
            }
            aria-label="Preview window"
            css={css`
              width: 160px;
            `}
          >
            <Label>Preview window</Label>
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
        <Flex direction="column" gap="size-50">
          <Text size="XS" weight="heavy" color="text-700">
            Span filter
          </Text>
          <SpanFilterConditionFieldCore
            projectId={projectId}
            filterCondition={filterConditionDraft}
            onFilterConditionChange={setFilterConditionDraft}
            onValidCondition={handleValidCondition}
            onValidityChange={handleValidityChange}
            placeholder="span_kind == 'LLM'"
          />
          <Text size="XS" color="text-500">
            Leave empty to evaluate every span.
          </Text>
        </Flex>
        <Flex direction="row" alignItems="center" gap="size-150">
          <span
            css={css`
              flex: 1 1 auto;
              min-width: 0;
            `}
          >
            <Suspense
              fallback={
                <Text size="S" color="text-500">
                  Counting matching spans…
                </Text>
              }
            >
              <ScopeEditorMatchedCountLine
                projectId={projectId}
                filterCondition={scope.filterCondition}
                timeWindow={timeWindow}
              />
            </Suspense>
          </span>
          <Button
            size="S"
            variant="primary"
            isDisabled={!isFilterValid}
            onPress={onDone}
          >
            Done
          </Button>
        </Flex>
      </Flex>
    </div>
  );
}

function ScopeEditorMatchedCountLine({
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
        Newest matching spans shown below
      </Text>
    );
  }
  return (
    <BoundedScopeEditorMatchedCountLine
      projectId={projectId}
      filterCondition={filterCondition}
      startIso={timeWindow.startIso}
      prose={timeWindow.prose}
    />
  );
}

function BoundedScopeEditorMatchedCountLine({
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
        ? `${matchedCount.toLocaleString()} span${matchedCount === 1 ? "" : "s"} matched ${prose} — newest shown below`
        : `No spans match this scope ${prose}`}
    </Text>
  );
}

const scopeEditorCardCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-200);
`;

/**
 * Lays the sampling slider out as one compact row — track, then value and "%"
 * inline — instead of the default label/value-over-track grid, whose output
 * cell stacks the "%" beneath the number field.
 */
const samplingSliderCSS = css`
  grid-template-areas: "track output";
  grid-template-columns: 1fr auto;
  align-items: center;
  /* Match the specificity of the base component's orientation rule, which
     otherwise wins with width: 100% and collapses the track. */
  &[data-orientation="horizontal"] {
    width: 220px;
  }
  .slider__output {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-50);
    min-height: 0;
  }
  .slider__number-field .react-aria-Input {
    margin-bottom: 0;
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

/**
 * The recent spans the committed scope matches, each row expandable to the
 * span's evaluation context and keyword bindings, and individually runnable
 * against the evaluator being authored. Run results stick to their row so
 * testing several spans accumulates visible results side by side.
 */
function SpanRunList({
  projectId,
  filterCondition,
  timeWindow,
  codeEvaluatorId,
  inlineCode,
}: {
  projectId: string;
  filterCondition: string;
  timeWindow: TimeWindow;
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
}) {
  const { shortDateTimeFormatter } = useTimeFormatters();
  const data = useLazyLoadQuery<ProjectEvaluatorScopePanelSpansQuery>(
    graphql`
      query ProjectEvaluatorScopePanelSpansQuery(
        $projectId: ID!
        $filterCondition: String
        $timeRange: TimeRange
      ) {
        project: node(id: $projectId) {
          ... on Project {
            spans(
              first: 5
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
    },
    { fetchPolicy: "store-and-network" }
  );
  const spans = data.project?.spans?.edges.map(({ span }) => span) ?? [];
  // With no matching spans, fall back to a semantic-convention sample so the
  // full authoring loop — mapping source, bindings, and test runs — still
  // works before matching traffic exists. Deriving it from the query result
  // means real spans replace it automatically.
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const activeRow = rows.find(({ key }) => key === expandedKey) ?? rows[0];
  const evaluatorStore = useEvaluatorStoreInstance();
  const pathMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  // Push the active row's context into the store as the mapping source so the
  // advanced-mapping editor autocompletes against a real span. Key the effect
  // on the row key (a primitive) — the row object is rebuilt every render.
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
  });
  if (rows.length === 0) {
    return <Empty message="No spans match this scope" />;
  }
  return (
    <div css={runListCSS}>
      {rows[0]?.isSample ? (
        <Text size="S" color="text-500">
          No matching spans yet — this stand-in span follows the OpenInference
          semantic conventions so you can author and test now. Real spans
          replace it automatically.
        </Text>
      ) : null}
      <ul aria-label="Recent matching spans" className="span-run-list__rows">
        {rows.map((row) => (
          <SpanRunRow
            key={row.key}
            row={row}
            isExpanded={expandedKey === row.key}
            onToggleExpanded={() =>
              setExpandedKey((current) =>
                current === row.key ? null : row.key
              )
            }
            run={runs[row.key]}
            isRunnable={isRunnable}
            onRun={() => runOnSpan(row.key, row.context)}
            pathMapping={pathMapping}
            formattedTime={
              row.startTime
                ? shortDateTimeFormatter(new Date(row.startTime))
                : null
            }
          />
        ))}
      </ul>
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
  onToggleExpanded,
  run,
  isRunnable,
  onRun,
  pathMapping,
  formattedTime,
}: {
  row: SpanListRow;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  run: SpanRun | undefined;
  isRunnable: boolean;
  onRun: () => void;
  pathMapping: Record<string, string>;
  formattedTime: string | null;
}) {
  const isRunning = run?.status === "running";
  return (
    <li css={runRowCSS} data-expanded={isExpanded}>
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
          aria-label={`Run evaluator on ${row.name}`}
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

/**
 * The run result pinned to a span row: the annotation the evaluator produced
 * (or a failure marker), persisting across runs on other rows.
 */
function SpanRunResultChip({ run }: { run: SpanRun | undefined }) {
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
    const valueParts = [
      annotation.label,
      annotation.score != null ? annotation.score.toLocaleString() : null,
    ].filter((part): part is string => part != null);
    return (
      <span css={resultChipCSS} title={annotation.explanation ?? undefined}>
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
  color: var(--global-color-success);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-25) var(--global-dimension-size-100);
`;

const resultChipDangerCSS = css`
  color: var(--global-color-danger);
`;

/**
 * The expanded view of a row's run: explanation text and any failures. The
 * chip carries the headline; this carries the reasoning.
 */
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
  /* Cap the editor and scroll inside CodeMirror so long contexts virtualize
     instead of rendering hundreds of thousands of pixels of DOM. */
  .cm-editor {
    max-height: 400px;
  }
  .cm-scroller {
    overflow: auto;
  }
`;

/**
 * Previews what each keyword binds to on this span: every top-level context
 * key that binds automatically (data-driven, not a hard-coded vocabulary) and
 * every explicit mapping with its resolved value or failure state.
 */
function BindingPreview({
  context,
  pathMapping,
  isSampleContext,
}: {
  context: unknown;
  pathMapping: Record<string, string>;
  isSampleContext: boolean;
}) {
  const diagnostics = getProjectEvaluatorMappingDiagnostics({
    context,
    pathMapping,
  });
  const automaticKeys = isStringKeyedObject(context)
    ? Object.keys(context).filter((key) => !(key in pathMapping))
    : [];
  return (
    <Flex direction="column" gap="size-100" marginTop="size-100">
      {isSampleContext ? (
        // Bindings against the sample prove the mapping's shape, not that it
        // resolves on this project's real spans — flag that up front.
        <Alert variant="info" title="Checked against a sample span">
          These bindings reflect the sample's structure, not real project data —
          re-check them once matching spans arrive.
        </Alert>
      ) : null}
      {automaticKeys.map((key) => (
        <div key={key} css={bindingRowCSS}>
          <code className="binding-row__keyword">{key}</code>
          <span className="binding-row__source">binds automatically</span>
          <span className="binding-row__value">
            {getBoundValueSnippet(
              isStringKeyedObject(context) ? context[key] : undefined
            )}
          </span>
        </div>
      ))}
      {diagnostics.map(({ variable, path, status }) =>
        status === "missing" ? (
          <Alert
            key={variable}
            variant="danger"
            title={`${variable} does not resolve`}
          >
            The path {path} would fail for this span.
          </Alert>
        ) : status === "unverified" ? (
          <Alert
            key={variable}
            variant="warning"
            title={`${variable} is unverified`}
          >
            The path {path} uses an expression that is verified by the server
            when the evaluator runs.
          </Alert>
        ) : (
          <div key={variable} css={bindingRowCSS}>
            <code className="binding-row__keyword">{variable}</code>
            <span className="binding-row__source">from {path}</span>
            <span className="binding-row__value">
              {getBoundValueSnippet(getValueAtPath(context, path))}
            </span>
          </div>
        )
      )}
    </Flex>
  );
}

const bindingRowCSS = css`
  display: flex;
  align-items: baseline;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  .binding-row__keyword {
    flex: none;
    font-family: var(--global-font-family-code, monospace);
    font-size: var(--global-font-size-xs);
    font-weight: 600;
    color: var(--global-text-color-900);
  }
  .binding-row__source {
    flex: none;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
  }
  .binding-row__value {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
  }
`;

/**
 * Extracts a one-line preview of a span's evaluation-context input so
 * same-named spans in the list are distinguishable at a glance.
 */
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
  // `input`/`output` are raw attribute values (string, null, object, ...);
  // only `metadata` is guaranteed to be an object by the server context shape.
  return isStringKeyedObject(value) && isStringKeyedObject(value.metadata);
}

/**
 * Manages per-span evaluator preview runs. Runs are keyed by span so several
 * can be in flight concurrently and each result stays pinned to its row.
 */
function useEvaluatorPreviewRuns({
  codeEvaluatorId,
  inlineCode,
}: {
  codeEvaluatorId?: string;
  inlineCode?: ProjectEvaluatorInlineCode;
}) {
  const evaluatorStore = useEvaluatorStoreInstance();
  const playgroundStore = usePlaygroundStore();
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
  // The LLM path builds the evaluator from the annotation template, so runs
  // unlock once that template validates (mirrored by the row play buttons).
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

/**
 * The feedback the evaluator will attach to matched spans — name,
 * optimization direction, and choice labels/scores — collapsible so a settled
 * template gets out of the way of the span list above it.
 */
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
          Configure the feedback your evaluator will attach to spans.
        </Text>
      </DisclosureTrigger>
      <DisclosurePanel>
        {/* Padding (not margin) around the card: the panel's expand animation
            measures content height, and child margins fall outside that
            measurement — the mismatch re-triggers the measurement loop every
            frame. */}
        <View padding="size-200">
          <EvaluatorCategoricalChoiceConfig />
        </View>
      </DisclosurePanel>
    </Disclosure>
  );
}

/**
 * Renders the standalone disclosure as a bordered card: the full card header
 * is the click target (a standalone disclosure trigger otherwise shrinks to
 * fit its text) and hover feedback spans the whole width.
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
    /* Keep the hover background inside the card's rounded corners without
       overflow: hidden, which would clip focus rings. */
    border-radius: calc(var(--global-rounding-medium) - 1px);
  }
  &[data-expanded="true"] [slot="trigger"] {
    border-bottom: 1px solid var(--global-border-color-default);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;
