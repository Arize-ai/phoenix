import { css } from "@emotion/react";
import type { ColumnDef, Table } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { throttle } from "lodash";
import {
  type SetStateAction,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  useRelayEnvironment,
} from "react-relay";
import { useSearchParams } from "react-router";
import { requestSubscription } from "relay-runtime";

import {
  createSetExpectedOutputClientAction,
  type ExpectedOutputExampleRow,
} from "@phoenix/agent/tools/playgroundEvaluator";
import { getInstanceLabel } from "@phoenix/agent/tools/playgroundPrompt";
import { registerUIOperations } from "@phoenix/agent/uiOperations/catalog";
import { setExpectedOutputOperation } from "@phoenix/agent/uiOperations/operations/playgroundEvaluator";
import {
  Alert,
  ExpandableContent,
  Flex,
  Icon,
  IconButton,
  Icons,
  ParagraphSkeleton,
  ProgressCircle,
  Text,
  View,
  ViewportModal,
  ViewportModalOverlay,
  VisuallyHidden,
} from "@phoenix/components";
import type { AnnotationConfig } from "@phoenix/components/annotation";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/core/tooltip";
import type { ExecutionState } from "@phoenix/components/core/types";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import {
  type AnnotationError,
  type AnnotationWithTrace,
  calculateAnnotationListHeight,
  calculateEstimatedRowHeight,
  CELL_PRIMARY_CONTENT_HEIGHT,
  ExperimentAnnotationAggregates,
  ExperimentCostAndLatencySummary,
  type ExperimentCostAndLatencySummaryExperiment,
  ExperimentInputCell,
  ExperimentMetadataCell,
  ExperimentReferenceOutputCell,
  ExperimentRunCellAnnotationsList,
} from "@phoenix/components/experiment";
import type { AnnotationSummary } from "@phoenix/components/experiment/ExperimentAnnotationAggregates";
import { CellTop } from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { SpanTokenCosts } from "@phoenix/components/trace";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useAgentStore } from "@phoenix/contexts/AgentContext";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import {
  getPlaygroundEvaluatorTask,
  getPlaygroundTaskKind,
  getTemplateVariablesPath,
} from "@phoenix/store/playground";
import {
  assertUnreachable,
  isStringArray,
  isStringKeyedObject,
} from "@phoenix/typeUtils";
import { getErrorMessagesFromRelaySubscriptionError } from "@phoenix/utils/errorUtils";
import {
  extractPathsFromDatasetExamples,
  getValueAtPath,
} from "@phoenix/utils/objectUtils";

import { ExperimentCompareDetailsDialog } from "../experiment/ExperimentCompareDetailsDialog";
import { ExperimentRepetitionSelector } from "../experiment/ExperimentRepetitionSelector";
import type { PlaygroundDatasetExamplesTableFragment$key } from "./__generated__/PlaygroundDatasetExamplesTableFragment.graphql";
import type { PlaygroundDatasetExamplesTableQuery } from "./__generated__/PlaygroundDatasetExamplesTableQuery.graphql";
import type { PlaygroundDatasetExamplesTableRefetchQuery } from "./__generated__/PlaygroundDatasetExamplesTableRefetchQuery.graphql";
import type {
  ExperimentsOverDatasetInput,
  PlaygroundDatasetExamplesTableSubscription as PlaygroundDatasetExamplesTableSubscriptionType,
} from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import PlaygroundDatasetExamplesTableSubscription from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import {
  getEvaluatorTaskAnnotation,
  PlaygroundEvaluatorColumnHeader,
  PlaygroundEvaluatorExampleCell,
  PlaygroundExpectedOutputsProvider,
  PlaygroundExpectedOutputsStatus,
  usePlaygroundExpectedOutputs,
} from "./evaluatorCells";
import { getEvaluatorTaskName } from "./evaluators/evaluatorTaskSnapshot";
import {
  ANNOTATIONS_KEY,
  getDisplayedMetadata,
  getExampleColumnLabels,
  getExampleColumnVisibility,
  hasDisplayableMetadata,
} from "./exampleColumns";
import {
  createExperimentsOverDatasetRouter,
  type ExperimentsOverDatasetEvent,
} from "./experimentsOverDatasetEvents";
import {
  getExperimentsOverDatasetInput,
  type PlaygroundEvaluatorMappings,
} from "./experimentsOverDatasetInput";
import {
  InstanceVariablesProvider,
  useInstanceVariables,
} from "./InstanceVariablesContext";
import {
  type ExperimentRunAnnotation,
  type ExperimentRunCost,
  type ExampleRunData,
  getExperimentRunCost,
  makeExpandedCellKey,
  type Span,
  usePlaygroundDatasetExamplesTableContext,
} from "./PlaygroundDatasetExamplesTableContext";
import { usePlaygroundDatasetExamplesTablePreferences } from "./PlaygroundDatasetExamplesTablePreferences";
import { PlaygroundErrorWrap } from "./PlaygroundErrorWrap";
import { PlaygroundExampleRowCell } from "./PlaygroundExampleRowCell";
import { PlaygroundOutputHeader } from "./PlaygroundOutputHeader";
import { PlaygroundRunTraceDetailsDialog } from "./PlaygroundRunTraceDialog";
import type { PartialOutputToolCall } from "./PlaygroundToolCall";
import { PlaygroundToolCall } from "./PlaygroundToolCall";
import { extractRootVariable } from "./playgroundUtils";

const PAGE_SIZE = 10;
// Wide enough for a two-digit row number over a small play button.
const ROW_COLUMN_WIDTH = 56;
const AGGREGATE_EXPERIMENT_METRICS_THROTTLE_MS = 2000;

/**
 * Maximum number of dataset examples to sample for extracting available paths
 * for template variable autocomplete. Higher values provide more complete
 * autocomplete suggestions but increase computation time.
 */
const MAX_EXAMPLES_FOR_PATH_EXTRACTION = 10;

const outputContentCSS = css`
  flex: none;
  padding: var(--global-dimension-size-200);
`;

/**
 * Get possible variable names based on the template variables path.
 *
 * @param datasetExample - The full dataset example with input, output, and metadata
 * @param templateVariablesPath - The path prefix for template variables
 * @returns Array of possible variable names
 */
function getPossibleVariablesForPath({
  datasetExample,
  templateVariablesPath,
}: {
  datasetExample: { input: unknown; output: unknown; metadata: unknown };
  templateVariablesPath: string | null;
}): string[] {
  // TODO: dynamically parse all valid root-level paths from the dataset example
  // instead of hardcoding these known keys
  const templateVariablesContext = {
    input: datasetExample.input,
    reference: datasetExample.output,
    metadata: datasetExample.metadata,
  };

  // Look up the object at the path and return its keys
  // When path is empty, getValueAtPath returns the whole context object
  const targetObject = getValueAtPath(
    templateVariablesContext,
    templateVariablesPath ?? ""
  );
  if (isStringKeyedObject(targetObject)) {
    return Object.keys(targetObject);
  }
  return [];
}

/**
 * Displays the status indicator in the cell header based on run state.
 * - Completed: Shows latency, token count, and cost stats
 * - Generating: Shows progress circle with "Generating..." text
 * - Cancelled: Shows stop icon with "Cancelled" text
 */
function CellRunStatus({
  span,
  isRunning,
}: {
  span: Span | null | undefined;
  isRunning: boolean;
}) {
  if (span) {
    return (
      <Flex direction="row" gap="size-100" alignItems="center" height="100%">
        <LatencyText latencyMs={span.latencyMs || 0} size="S" />
        <SpanTokenCount
          tokenCountTotal={span.tokenCountTotal || 0}
          nodeId={span.id}
        />
        <SpanTokenCosts
          totalCost={span.costSummary?.total?.cost || 0}
          spanNodeId={span.id}
        />
      </Flex>
    );
  }

  if (isRunning) {
    return (
      <Flex direction="row" gap="size-100" alignItems="center">
        <ProgressCircle isIndeterminate size="S" aria-label="Generating" />
        <Text color="text-500" fontStyle="italic">
          Generating...
        </Text>
      </Flex>
    );
  }

  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="center"
      css={css`
        color: var(--global-text-color-500);
      `}
    >
      <Icon svg={<Icons.MinusCircle />} />
      <Text color="inherit">Cancelled</Text>
    </Flex>
  );
}

function EmptyExampleOutput({
  isRunning,
  instanceVariables,
  datasetExample,
  templateVariablesPath,
  evaluatorOutputConfigs,
  isExpanded,
  onExpandedChange,
}: {
  isRunning: boolean;
  instanceVariables: string[];
  datasetExample: { input: unknown; output: unknown; metadata: unknown };
  templateVariablesPath: string | null;
  evaluatorOutputConfigs: AnnotationConfig[];
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}) {
  // Build the template variables context matching the backend mapping
  // (output is renamed to reference)
  const templateVariablesContext = useMemo(
    () => ({
      input: datasetExample.input,
      reference: datasetExample.output,
      metadata: datasetExample.metadata,
    }),
    [datasetExample]
  );

  // Get the target object based on the template variables path
  const targetObject = useMemo((): Record<string, unknown> => {
    if (!templateVariablesPath) {
      return templateVariablesContext as Record<string, unknown>;
    }
    const value = getValueAtPath(
      templateVariablesContext,
      templateVariablesPath
    );
    return isStringKeyedObject(value) ? value : {};
  }, [templateVariablesContext, templateVariablesPath]);

  // Get possible variables based on the path
  const possibleVariables = useMemo(() => {
    return getPossibleVariablesForPath({
      datasetExample,
      templateVariablesPath,
    });
  }, [datasetExample, templateVariablesPath]);

  const missingVariables = useMemo(() => {
    // Extract root variable from paths (e.g., "input.input.messages" -> "input")
    // and check if the root variable exists in the target object
    return instanceVariables.filter((variable) => {
      const rootVariable = extractRootVariable(variable);
      return targetObject[rootVariable] == null;
    });
  }, [targetObject, instanceVariables]);

  let cellTopContent: ReactNode | null = <Text color="text-500">Ready</Text>;
  let content: ReactNode | null = (
    <Text color="text-500">Press run to generate</Text>
  );
  if (isRunning) {
    content = <ParagraphSkeleton lines={4} />;
    cellTopContent = (
      <Flex direction="row" gap="size-100" alignItems="center">
        <Icon svg={<Icons.Loader />} />
        <Text color="text-500">Queued</Text>
      </Flex>
    );
  }
  if (missingVariables.length > 0) {
    cellTopContent = <Text color="danger">Missing variables</Text>;
    content = (
      <PlaygroundErrorWrap>
        {`Dataset is missing input for variable${missingVariables.length > 1 ? "s" : ""}: ${missingVariables.join(
          ", "
        )}.${
          possibleVariables.length > 0
            ? ` Possible inputs start with: ${possibleVariables.join(", ")}`
            : " No inputs found in dataset example."
        }`}
      </PlaygroundErrorWrap>
    );
  }
  return (
    <Flex direction="column" height="100%">
      <CellTop>{cellTopContent}</CellTop>
      <ExpandableContent
        height={CELL_PRIMARY_CONTENT_HEIGHT}
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
      >
        <div css={outputContentCSS}>{content}</div>
      </ExpandableContent>
      <ExperimentRunCellAnnotationsList
        annotations={[]}
        annotationConfigs={evaluatorOutputConfigs}
        executionState={isRunning ? "running" : "idle"}
      />
    </Flex>
  );
}

function ExampleOutputContent({
  exampleData,
  repetitionNumber,
  setRepetitionNumber,
  totalRepetitions,
  onViewExperimentRunDetailsPress,
  onViewTracePress,
  evaluatorOutputConfigs,
  isRunning,
  isExpanded,
  onExpandedChange,
}: {
  exampleData: ExampleRunData;
  repetitionNumber: number;
  setRepetitionNumber: (n: SetStateAction<number>) => void;
  totalRepetitions: number;
  onViewExperimentRunDetailsPress: () => void;
  onViewTracePress: (
    traceId: string,
    projectId: string,
    evaluatorName?: string
  ) => void;
  evaluatorOutputConfigs: AnnotationConfig[];
  isRunning: boolean;
  isExpanded: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
}) {
  const {
    span,
    content,
    toolCalls,
    errorMessage,
    experimentRunId,
    evaluations,
  } = exampleData;
  const hasSpan = span != null;
  const hasExperimentRun = experimentRunId != null;
  const spanControls = useMemo(() => {
    return (
      <>
        {totalRepetitions > 1 && (
          <ExperimentRepetitionSelector
            repetitionNumber={repetitionNumber}
            totalRepetitions={totalRepetitions}
            setRepetitionNumber={setRepetitionNumber}
          />
        )}
        <TooltipTrigger isDisabled={!hasExperimentRun}>
          <IconButton
            size="S"
            aria-label="View experiment run details"
            isDisabled={!hasExperimentRun}
            onPress={onViewExperimentRunDetailsPress}
          >
            <Icon svg={<Icons.Expand />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            view experiment run
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger isDisabled={!hasSpan}>
          <IconButton
            size="S"
            aria-label="View run trace"
            isDisabled={!hasSpan}
            onPress={() => {
              if (span) {
                onViewTracePress(span.context.traceId, span.project.id);
              }
            }}
          >
            <Icon svg={<Icons.Trace />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            view run trace
          </Tooltip>
        </TooltipTrigger>
      </>
    );
  }, [
    hasExperimentRun,
    hasSpan,
    repetitionNumber,
    setRepetitionNumber,
    span,
    totalRepetitions,
    onViewExperimentRunDetailsPress,
    onViewTracePress,
  ]);

  const { successfulEvaluations, evaluationErrors } = useMemo(() => {
    const successful: AnnotationWithTrace[] = [];
    const errors: AnnotationError[] = [];

    for (const e of evaluations ?? []) {
      if (e.error != null) {
        errors.push({
          evaluatorName: e.evaluatorName,
          message: e.error,
          trace: e.trace,
        });
      } else if (e.experimentRunEvaluation != null) {
        const evaluation = e.experimentRunEvaluation;
        successful.push({
          ...evaluation,
          trace: e.trace,
        });
      }
    }

    return { successfulEvaluations: successful, evaluationErrors: errors };
  }, [evaluations]);

  return (
    <Flex direction="column" height="100%">
      <CellTop extra={spanControls}>
        <CellRunStatus span={span} isRunning={isRunning} />
      </CellTop>
      <ExpandableContent
        height={CELL_PRIMARY_CONTENT_HEIGHT}
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
      >
        <div css={outputContentCSS}>
          <Flex direction={"column"} gap="size-100">
            {errorMessage != null ? (
              <PlaygroundErrorWrap key="error-message">
                {errorMessage}
              </PlaygroundErrorWrap>
            ) : null}
            {content != null ? (
              <DynamicContent value={content} mode="streaming" key="content" />
            ) : null}
            {toolCalls != null && Object.keys(toolCalls).length > 0
              ? Object.values(toolCalls)
                  .filter((tc): tc is PartialOutputToolCall => tc != null)
                  .map((toolCall) => (
                    <View key={toolCall.id}>
                      <PlaygroundToolCall toolCall={toolCall} />
                    </View>
                  ))
              : null}
          </Flex>
        </div>
      </ExpandableContent>
      <ExperimentRunCellAnnotationsList
        annotations={successfulEvaluations}
        annotationErrors={evaluationErrors}
        annotationConfigs={evaluatorOutputConfigs}
        executionState={isRunning ? "running" : "idle"}
        onTraceClick={({ traceId, projectId, annotationName }) => {
          if (traceId && projectId) {
            onViewTracePress(traceId, projectId, annotationName);
          }
        }}
      />
    </Flex>
  );
}

const MemoizedExampleOutputCell = memo(function ExampleOutputCell({
  isRunning,
  instanceId,
  exampleId,
  datasetExample,
  templateVariablesPath,
  onViewExperimentRunDetailsPress,
  onViewTracePress,
  evaluatorOutputConfigs,
}: {
  instanceId: number;
  exampleId: string;
  isRunning: boolean;
  datasetExample: { input: unknown; output: unknown; metadata: unknown };
  templateVariablesPath: string | null;
  onViewExperimentRunDetailsPress: () => void;
  onViewTracePress: (
    traceId: string,
    projectId: string,
    evaluatorName?: string
  ) => void;
  evaluatorOutputConfigs: AnnotationConfig[];
}) {
  const instanceVariables = useInstanceVariables(instanceId);
  const [repetitionNumber, setRepetitionNumber] = useState(1);
  const totalRepetitions = usePlaygroundDatasetExamplesTableContext(
    (state) => state.repetitions
  );
  const examplesByRepetitionNumber = usePlaygroundDatasetExamplesTableContext(
    (store) => store.exampleResponsesMap[instanceId]?.[exampleId]
  );
  const expandedCellKey = makeExpandedCellKey(
    instanceId,
    exampleId,
    repetitionNumber
  );
  const isExpanded = usePlaygroundDatasetExamplesTableContext(
    (state) => state.expandedCells[expandedCellKey] ?? false
  );
  const setExpandedCell = usePlaygroundDatasetExamplesTableContext(
    (state) => state.setExpandedCell
  );
  const onExpandedChange = useCallback(
    (expanded: boolean) => {
      setExpandedCell({
        instanceId,
        exampleId,
        repetitionNumber,
        isExpanded: expanded,
      });
    },
    [setExpandedCell, instanceId, exampleId, repetitionNumber]
  );
  const exampleData = useMemo(() => {
    return examplesByRepetitionNumber?.[repetitionNumber];
  }, [examplesByRepetitionNumber, repetitionNumber]);
  return exampleData == null ? (
    <EmptyExampleOutput
      isRunning={isRunning}
      instanceVariables={instanceVariables}
      datasetExample={datasetExample}
      templateVariablesPath={templateVariablesPath}
      evaluatorOutputConfigs={evaluatorOutputConfigs}
      isExpanded={isExpanded}
      onExpandedChange={onExpandedChange}
    />
  ) : (
    <ExampleOutputContent
      exampleData={exampleData}
      repetitionNumber={repetitionNumber}
      totalRepetitions={totalRepetitions}
      setRepetitionNumber={setRepetitionNumber}
      onViewExperimentRunDetailsPress={onViewExperimentRunDetailsPress}
      onViewTracePress={onViewTracePress}
      evaluatorOutputConfigs={evaluatorOutputConfigs}
      isRunning={isRunning}
      isExpanded={isExpanded}
      onExpandedChange={onExpandedChange}
    />
  );
});

// un-memoized normal table body component - see memoized version below
function TableBody<T>({
  table,
  tableContainerRef,
  estimatedRowHeight,
}: {
  table: Table<T>;
  tableContainerRef: RefObject<HTMLDivElement | null>;
  estimatedRowHeight: number;
}) {
  "use no memo";
  const rows = table.getRowModel().rows;
  // eslint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 5,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const spacerRowHeight = useMemo(() => {
    return totalHeight - virtualRows.reduce((acc, item) => acc + item.size, 0);
  }, [totalHeight, virtualRows]);

  return (
    <tbody>
      {virtualRows.map((virtualRow, index) => {
        const row = rows[virtualRow.index];
        return (
          <tr
            key={row.id}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${
                virtualRow.start - index * virtualRow.size
              }px)`,
            }}
          >
            {row.getVisibleCells().map((cell) => {
              return (
                <td
                  key={cell.id}
                  style={{
                    padding: 0,
                    verticalAlign: "top",
                    width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                    maxWidth: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                    minWidth: 0,
                    // allow long text with no symbols or spaces to wrap
                    // otherwise, it will prevent the cell from shrinking
                    // an alternative solution would be to set a max-width and allow
                    // the cell to scroll itself
                    wordBreak: "break-all",
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
      <tr>
        <td
          style={{
            height: `${spacerRowHeight}px`,
            padding: 0,
          }}
          colSpan={table.getAllColumns().length}
        />
      </tr>
    </tbody>
  );
}
// special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

function getExecutionState({
  hasData,
  isRunning,
  experimentId,
}: {
  hasData: boolean;
  isRunning: boolean;
  experimentId: string | null | undefined;
}): ExecutionState {
  if (hasData) return "complete";
  if (isRunning) return "running";
  if (experimentId != null) return "complete";
  return "idle";
}

function PlaygroundInstanceOutputColumnHeader({
  instanceId,
  index,
  experimentId,
  isRunning,
  evaluatorOutputConfigs,
}: {
  instanceId: number;
  index: number;
  experimentId: string | null | undefined;
  isRunning: boolean;
  evaluatorOutputConfigs: readonly AnnotationConfig[];
}) {
  const annotationAggregateMetrics = usePlaygroundDatasetExamplesTableContext(
    (state) => state.runAnnotationAggregateMetrics[instanceId] ?? null
  );
  const costAggregateMetrics = usePlaygroundDatasetExamplesTableContext(
    (state) => state.runCostAggregateMetrics[instanceId] ?? null
  );
  const annotationSummaries = useMemo<AnnotationSummary[]>(() => {
    if (annotationAggregateMetrics == null) {
      return [];
    }
    return Object.entries(annotationAggregateMetrics).map(
      ([annotationName, metric]) => ({
        annotationName,
        meanScore: metric.count > 0 ? metric.sum / metric.count : null,
      })
    );
  }, [annotationAggregateMetrics]);
  const costSummary =
    useMemo<ExperimentCostAndLatencySummaryExperiment | null>(() => {
      const resolvedExperimentId = experimentId ?? null;
      if (
        resolvedExperimentId == null ||
        costAggregateMetrics == null ||
        costAggregateMetrics.runCount === 0
      ) {
        return null;
      }
      return {
        id: resolvedExperimentId,
        averageRunLatencyMs:
          costAggregateMetrics.latencyCount > 0
            ? costAggregateMetrics.latencySum /
              costAggregateMetrics.latencyCount
            : null,
        runCount: costAggregateMetrics.runCount,
        costSummary: {
          total: {
            cost:
              costAggregateMetrics.costCount > 0
                ? costAggregateMetrics.costSum
                : null,
            tokens:
              costAggregateMetrics.tokenCountCount > 0
                ? costAggregateMetrics.tokenCountSum
                : null,
          },
        },
      };
    }, [experimentId, costAggregateMetrics]);

  const costExecutionState = getExecutionState({
    hasData: costSummary != null,
    isRunning,
    experimentId,
  });

  const annotationExecutionState = getExecutionState({
    hasData: annotationSummaries.length > 0,
    isRunning,
    experimentId,
  });

  return (
    <Flex direction="column" gap="size-50" width="100%">
      <PlaygroundOutputHeader instanceId={instanceId} index={index} />
      <ExperimentCostAndLatencySummary
        executionState={costExecutionState}
        experiment={costSummary}
      />
      <ExperimentAnnotationAggregates
        executionState={annotationExecutionState}
        annotationConfigs={evaluatorOutputConfigs}
        annotationSummaries={annotationSummaries}
      />
    </Flex>
  );
}

/**
 * Mounts `playground.expectedOutput.set` while the table shows a dataset.
 * Only here are the rows' revision ids and the expected-output writer, and
 * PXI's write goes out at once instead of waiting for the batching delay.
 * Registered once per table mount; the rows are read fresh through a ref.
 */
function PlaygroundExpectedOutputAgentOperation({
  examples,
}: {
  examples: ReadonlyArray<ExpectedOutputExampleRow>;
}) {
  const agentStore = useAgentStore();
  const playgroundStore = usePlaygroundStore();
  const { saveNow } = usePlaygroundExpectedOutputs();
  const examplesRef = useRef(examples);
  useEffect(() => {
    examplesRef.current = examples;
  });
  useEffect(
    () =>
      registerUIOperations({
        agentStore,
        operations: [
          {
            descriptor: setExpectedOutputOperation,
            handler: createSetExpectedOutputClientAction({
              playgroundStore,
              getExamples: () => examplesRef.current,
              saveNow,
            }),
          },
        ],
      }),
    [agentStore, playgroundStore, saveNow]
  );

  return null;
}

export function PlaygroundDatasetExamplesTable({
  datasetId,
  splitIds,
  evaluatorMappings,
  evaluatorOutputConfigs,
  onHasMetadataChange,
}: {
  datasetId: string;
  splitIds?: string[];
  evaluatorOutputConfigs: AnnotationConfig[];
  /**
   * Record of evaluator id to name and input mappings
   */
  evaluatorMappings: PlaygroundEvaluatorMappings;
  /**
   * Called with whether a loaded example has metadata to show, for the
   * toolbar's column selector, which has no rows of its own to look at.
   */
  onHasMetadataChange: (hasMetadata: boolean) => void;
}) {
  const environment = useRelayEnvironment();
  const instances = usePlaygroundContext((state) => state.instances);
  const columnLabels = getExampleColumnLabels(getPlaygroundTaskKind(instances));
  const { baseExperimentId, compareExperimentIds } = useMemo(() => {
    const experimentIds = instances.map((instance) => instance.experiment?.id);
    const [baseExperimentId, ...compareExperimentIds] = experimentIds;
    return { baseExperimentId, compareExperimentIds };
  }, [instances]);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState<
    number | null
  >(null);
  const [selectedTraceInfo, setSelectedTraceInfo] = useState<{
    traceId: string;
    projectId: string;
    evaluatorName?: string;
  } | null>(null);
  // Scopes the autocomplete paths and the prompt cells' variable checks to
  // where the page's kind of task reads its variables from.
  const templateVariablesPath = usePlaygroundContext((state) =>
    getTemplateVariablesPath({
      stateByDatasetId: state.stateByDatasetId,
      datasetId,
      taskKind: getPlaygroundTaskKind(state.instances),
    })
  );
  const setAvailablePaths = usePlaygroundContext(
    (state) => state.setAvailablePaths
  );
  const numEnabledEvaluators = evaluatorOutputConfigs.length;
  const annotationListHeight =
    calculateAnnotationListHeight(numEnabledEvaluators);

  const setInstanceExperiment = usePlaygroundContext(
    (state) => state.setInstanceExperiment
  );

  const runPlaygroundInstances = usePlaygroundContext(
    (state) => state.runPlaygroundInstances
  );

  const updateExampleData = usePlaygroundDatasetExamplesTableContext(
    (state) => state.updateExampleData
  );

  const resetInstanceData = usePlaygroundDatasetExamplesTableContext(
    (state) => state.resetInstanceData
  );
  const resetExampleData = usePlaygroundDatasetExamplesTableContext(
    (state) => state.resetExampleData
  );
  const appendExampleDataToolCallChunk =
    usePlaygroundDatasetExamplesTableContext(
      (state) => state.appendExampleDataToolCallChunk
    );
  const appendExampleDataTextChunk = usePlaygroundDatasetExamplesTableContext(
    (state) => state.appendExampleDataTextChunk
  );
  const appendExampleDataEvaluationChunk =
    usePlaygroundDatasetExamplesTableContext(
      (state) => state.appendExampleDataEvaluationChunk
    );
  const addRunAnnotations = usePlaygroundDatasetExamplesTableContext(
    (state) => state.addRunAnnotations
  );
  const addRunCosts = usePlaygroundDatasetExamplesTableContext(
    (state) => state.addRunCosts
  );

  const pendingExperimentRunAnnotations = useRef<ExperimentRunAnnotation[]>([]);
  const pendingExperimentRunCosts = useRef<ExperimentRunCost[]>([]);

  // Throttled to avoid re-rendering aggregate statistics with every eval chunk;
  // instead updates at most once per AGGREGATE_EXPERIMENT_METRICS_THROTTLE_MS for readability.
  const flushPendingExperimentMetrics = useMemo(
    () =>
      throttle(
        () => {
          const annotations = pendingExperimentRunAnnotations.current;
          pendingExperimentRunAnnotations.current = [];
          if (annotations.length > 0) {
            addRunAnnotations(annotations);
          }

          const costs = pendingExperimentRunCosts.current;
          pendingExperimentRunCosts.current = [];
          if (costs.length > 0) {
            addRunCosts(costs);
          }
        },
        AGGREGATE_EXPERIMENT_METRICS_THROTTLE_MS,
        { leading: true, trailing: true }
      ),
    [addRunAnnotations, addRunCosts]
  );
  const handleExperimentRunAnnotation = useCallback(
    (annotation: ExperimentRunAnnotation) => {
      pendingExperimentRunAnnotations.current.push(annotation);
      flushPendingExperimentMetrics();
    },
    [flushPendingExperimentMetrics]
  );
  const handleExperimentRunCost = useCallback(
    (cost: ExperimentRunCost) => {
      pendingExperimentRunCosts.current.push(cost);
      flushPendingExperimentMetrics();
    },
    [flushPendingExperimentMetrics]
  );
  const resetPendingExperimentMetrics = useCallback(() => {
    flushPendingExperimentMetrics.cancel();
    pendingExperimentRunAnnotations.current = [];
    pendingExperimentRunCosts.current = [];
  }, [flushPendingExperimentMetrics]);

  useEffect(() => {
    return () => {
      flushPendingExperimentMetrics.flush();
      flushPendingExperimentMetrics.cancel();
    };
  }, [flushPendingExperimentMetrics]);

  const setRepetitions = usePlaygroundDatasetExamplesTableContext(
    (state) => state.setRepetitions
  );
  const repetitions = usePlaygroundContext((state) => state.repetitions);

  const [, setSearchParams] = useSearchParams();
  const hasSomeRunIds = instances.some(
    (instance) => instance.activeRunId !== null
  );

  const credentials = useCredentialsContext((state) => state);
  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  const playgroundStore = usePlaygroundStore();

  const [apiError, setApiError] = useState<string | null>(null);

  const { dataset } = useLazyLoadQuery<PlaygroundDatasetExamplesTableQuery>(
    graphql`
      query PlaygroundDatasetExamplesTableQuery(
        $datasetId: ID!
        $splitIds: [ID!]
      ) {
        dataset: node(id: $datasetId) {
          ...PlaygroundDatasetExamplesTableFragment
            @arguments(splitIds: $splitIds)
          ... on Dataset {
            exampleCount(splitIds: $splitIds)
            latestVersions: versions(
              first: 1
              sort: { col: createdAt, dir: desc }
            ) {
              edges {
                version: node {
                  id
                }
              }
            }
          }
        }
      }
    `,
    { datasetId, splitIds: splitIds ?? null }
  );

  const exampleCount = dataset.exampleCount ?? 0;
  const evaluatorCount = Object.keys(evaluatorMappings).length;

  const incrementRunsCompleted = usePlaygroundContext(
    (state) => state.incrementRunsCompleted
  );
  const incrementRunsFailed = usePlaygroundContext(
    (state) => state.incrementRunsFailed
  );
  const incrementEvalsCompleted = usePlaygroundContext(
    (state) => state.incrementEvalsCompleted
  );
  const incrementEvalsFailed = usePlaygroundContext(
    (state) => state.incrementEvalsFailed
  );
  const initExperimentRunProgress = usePlaygroundContext(
    (state) => state.initExperimentRunProgress
  );

  const applyEvent = useCallback(
    (event: ExperimentsOverDatasetEvent) => {
      switch (event.type) {
        case "experimentStarted":
          // A row run is a spot check beside the column's experiment, so the
          // column keeps its link to the last full run.
          if (playgroundStore.getState().runExampleIds == null) {
            setInstanceExperiment(event.instanceId, {
              id: event.experimentId,
              isEphemeral: !playgroundStore.getState().recordExperiments,
            });
          }

          return;
        case "experimentFailed":
          setApiError(event.message);

          return;
        case "runCompleted": {
          const { instanceId, exampleId, repetitionNumber, span } = event;
          updateExampleData({
            instanceId,
            exampleId,
            repetitionNumber,
            patch: { span, experimentRunId: event.experimentRunId },
          });
          handleExperimentRunCost(getExperimentRunCost(instanceId, span));
          incrementRunsCompleted(instanceId);

          return;
        }

        case "runFailed": {
          const { instanceId, exampleId, repetitionNumber, span } = event;
          updateExampleData({
            instanceId,
            exampleId,
            repetitionNumber,
            patch: {
              errorMessage: event.message,
              span,
              experimentRunId: event.experimentRunId,
            },
          });

          if (span) {
            handleExperimentRunCost(getExperimentRunCost(instanceId, span));
          }

          incrementRunsFailed(instanceId);

          return;
        }

        case "textChunk": {
          const { instanceId, exampleId, repetitionNumber } = event;
          appendExampleDataTextChunk({
            instanceId,
            exampleId,
            repetitionNumber,
            textChunk: event.content,
          });

          return;
        }

        case "toolCallChunk": {
          const { instanceId, exampleId, repetitionNumber } = event;
          appendExampleDataToolCallChunk({
            instanceId,
            exampleId,
            repetitionNumber,
            toolCallChunk: event.toolCallChunk,
          });

          return;
        }

        case "evaluation": {
          const { instanceId, exampleId, repetitionNumber, evaluationChunk } =
            event;

          appendExampleDataEvaluationChunk({
            instanceId,
            exampleId,
            repetitionNumber,
            evaluationChunk,
          });
          handleExperimentRunAnnotation({
            instanceId,
            annotationName: evaluationChunk.evaluatorName,
            score: evaluationChunk.experimentRunEvaluation?.score ?? null,
          });

          if (evaluationChunk.error != null) {
            incrementEvalsFailed(instanceId);
          } else {
            incrementEvalsCompleted(instanceId);
          }

          return;
        }

        default:
          assertUnreachable(event);
      }
    },
    [
      handleExperimentRunAnnotation,
      handleExperimentRunCost,
      appendExampleDataTextChunk,
      appendExampleDataToolCallChunk,
      appendExampleDataEvaluationChunk,
      incrementEvalsCompleted,
      incrementEvalsFailed,
      incrementRunsCompleted,
      incrementRunsFailed,
      playgroundStore,
      setInstanceExperiment,
      updateExampleData,
    ]
  );

  useEffect(() => {
    if (!hasSomeRunIds) {
      return undefined;
    }

    const runningInstances = playgroundStore
      .getState()
      .instances.filter((instance) => instance.activeRunId != null);

    const runningInstanceIds = runningInstances.map((instance) => instance.id);
    // A row run covers one example: only that row's cells start over, and the
    // column keeps its experiment link.
    const runExampleIds = playgroundStore.getState().runExampleIds;
    setApiError(null);
    resetPendingExperimentMetrics();

    if (runExampleIds) {
      resetExampleData({
        instanceIds: runningInstanceIds,
        exampleIds: runExampleIds,
      });
    } else {
      resetInstanceData(runningInstanceIds);
    }

    setRepetitions(repetitions);
    const runExampleCount = runExampleIds?.length ?? exampleCount;

    for (const instance of runningInstances) {
      if (!runExampleIds) {
        setInstanceExperiment(instance.id, null);
      }

      initExperimentRunProgress(instance.id, {
        totalRuns: runExampleCount * repetitions,
        runsCompleted: 0,
        runsFailed: 0,
        // An evaluator task's verdicts are its runs; only a prompt task has
        // dataset evaluators scoring its outputs afterwards.
        totalEvals:
          instance.task.kind === "evaluator"
            ? 0
            : runExampleCount * repetitions * evaluatorCount,
        evalsCompleted: 0,
        evalsFailed: 0,
      });
    }

    const finish = () => {
      flushPendingExperimentMetrics.flush();

      for (const instanceId of runningInstanceIds) {
        markPlaygroundInstanceComplete(instanceId);
      }
    };

    let input: ExperimentsOverDatasetInput;

    try {
      input = getExperimentsOverDatasetInput({
        playgroundStore,
        credentials,
        datasetId,
        splitIds,
        evaluatorMappings,
        instanceIds: runningInstanceIds,
      });
    } catch (error) {
      // A task that cannot be sent (an incomplete judge prompt, say) ends the
      // run before it starts, with the reason where run errors show.
      setApiError(error instanceof Error ? error.message : String(error));
      finish();

      return undefined;
    }

    // One subscription carries every task's experiment; the router tells the
    // payloads apart by the experiments the server opens the stream with.
    const router = createExperimentsOverDatasetRouter(runningInstanceIds);

    const subscription =
      requestSubscription<PlaygroundDatasetExamplesTableSubscriptionType>(
        environment,
        {
          subscription: PlaygroundDatasetExamplesTableSubscription,
          variables: { input },
          onNext: (response) => {
            const event = response
              ? router.route(response.experimentsOverDataset)
              : null;

            if (event) {
              applyEvent(event);
            }
          },
          onCompleted: finish,
          onError: (error) => {
            finish();

            const errorMessages =
              getErrorMessagesFromRelaySubscriptionError(error);

            setApiError(
              errorMessages != null && errorMessages.length > 0
                ? errorMessages.join("\n")
                : error.message
            );
          },
        }
      );

    playgroundStore.getState().consumeNextExperimentScaffold();
    return () => {
      resetPendingExperimentMetrics();
      subscription.dispose();
    };
  }, [
    applyEvent,
    credentials,
    datasetId,
    splitIds,
    environment,
    evaluatorCount,
    evaluatorMappings,
    exampleCount,
    hasSomeRunIds,
    initExperimentRunProgress,
    markPlaygroundInstanceComplete,
    resetPendingExperimentMetrics,
    flushPendingExperimentMetrics,
    playgroundStore,
    repetitions,
    resetExampleData,
    resetInstanceData,
    setInstanceExperiment,
    setRepetitions,
  ]);

  // Use useState + callback ref instead of useRef so that the component
  // re-renders when the container element mounts (needed for virtualizer)
  const [_tableContainerEl, setTableContainerEl] =
    useState<HTMLDivElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const tableContainerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    tableContainerRef.current = el;
    setTableContainerEl(el);
  }, []);

  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
      PlaygroundDatasetExamplesTableRefetchQuery,
      PlaygroundDatasetExamplesTableFragment$key
    >(
      graphql`
        fragment PlaygroundDatasetExamplesTableFragment on Dataset
        @refetchable(queryName: "PlaygroundDatasetExamplesTableRefetchQuery")
        @argumentDefinitions(
          datasetVersionId: { type: "ID" }
          splitIds: { type: "[ID!]" }
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 20 }
        ) {
          examples(
            datasetVersionId: $datasetVersionId
            splitIds: $splitIds
            first: $first
            after: $after
          ) @connection(key: "PlaygroundDatasetExamplesTable_examples") {
            edges {
              example: node {
                id
                externalId
                revision {
                  input
                  output
                  metadata
                  revisionId
                  calibrationLabels {
                    annotationName
                    label
                    score
                    explanation
                  }
                }
              }
            }
          }
        }
      `,
      dataset
    );

  // Refetch the data when the dataset version changes
  const tableData = useMemo(
    () =>
      data.examples.edges.map((edge) => {
        const example = edge.example;
        const revision = example.revision;
        return {
          id: example.id,
          externalId: example.externalId,
          input: revision.input,
          output: revision.output,
          metadata: revision.metadata,
          revisionId: revision.revisionId,
          calibrationLabels: revision.calibrationLabels,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];

  const revisionIdByExampleId = useMemo(
    () => new Map(tableData.map((row) => [row.id, row.revisionId])),
    [tableData]
  );

  // Whether the metadata cells leave the `annotations` key out; a per-browser
  // setting behind the toolbar's gear.
  const hideAnnotations = usePreferencesContext(
    (state) => state.hideExpectedAnnotationsInMetadata
  );

  // The metadata column shows itself while a loaded example has metadata and
  // no column choice is stored; the toolbar's selector shows the same state.
  const hasMetadata = useMemo(
    () =>
      tableData.some((row) =>
        hasDisplayableMetadata(row.metadata, { hideAnnotations })
      ),
    [tableData, hideAnnotations]
  );

  useEffect(() => {
    onHasMetadataChange(hasMetadata);
  }, [hasMetadata, onHasMetadataChange]);

  const storedVisibility = usePlaygroundDatasetExamplesTablePreferences(
    (state) => state.columnVisibility
  );

  const setColumnVisibility = usePlaygroundDatasetExamplesTablePreferences(
    (state) => state.setColumnVisibility
  );

  const columnVisibility = useMemo(
    () => getExampleColumnVisibility({ hasMetadata, storedVisibility }),
    [hasMetadata, storedVisibility]
  );

  const reloadExamples = useCallback(() => {
    refetch({}, { fetchPolicy: "network-only" });
  }, [refetch]);

  const exampleIds = useMemo(() => {
    return tableData.map((row) => row.id);
  }, [tableData]);

  // Compute and cache available paths for template autocomplete when examples are loaded
  // or when templateVariablesPath changes (which scopes the paths)
  useEffect(() => {
    if (tableData.length > 0) {
      const examples = tableData.map((row) => ({
        input: row.input,
        reference: row.output,
        metadata: row.metadata,
      }));
      const paths = extractPathsFromDatasetExamples(
        examples,
        templateVariablesPath,
        MAX_EXAMPLES_FOR_PATH_EXTRACTION
      );
      setAvailablePaths({ availablePaths: paths, datasetId });
    } else {
      // Clear paths when dataset becomes empty to avoid stale autocomplete suggestions
      setAvailablePaths({ availablePaths: [], datasetId });
    }
  }, [tableData, datasetId, templateVariablesPath, setAvailablePaths]);

  // We assume that the experiments were run on the latest version of the dataset.
  // This is subject to a race condition where a new dataset version is created after the playground experiments were run.
  // We ignore this edge case for now.
  const datasetVersionId = useMemo(() => {
    return dataset.latestVersions?.edges[0]?.version.id ?? "";
  }, [dataset.latestVersions?.edges]);

  const playgroundInstanceOutputColumns = useMemo((): ColumnDef<TableRow>[] => {
    return instances.map((instance, index) => {
      const isRunning = instance.activeRunId !== null;
      const experimentId = instance.experiment?.id ?? null;
      const evaluator = getPlaygroundEvaluatorTask(instance);

      if (evaluator) {
        const label = getInstanceLabel(index);
        const evaluatorName = getEvaluatorTaskName(evaluator, index);

        const annotation = getEvaluatorTaskAnnotation({
          evaluator,
          position: index,
        });

        return {
          id: `instance-${instance.id}`,
          // The header reads the rows off the table so the columns need not
          // be rebuilt as pages of examples load.
          header: ({ table }) => (
            <PlaygroundEvaluatorColumnHeader
              instanceId={instance.id}
              index={index}
              name={evaluatorName}
              annotationName={annotation.name}
              output={annotation.output}
              examples={table.options.data}
              isRunning={isRunning}
              canRun={!hasSomeRunIds}
              onRun={() => runPlaygroundInstances([instance.id])}
            />
          ),
          cell: ({ row }) => (
            <PlaygroundEvaluatorExampleCell
              instanceId={instance.id}
              label={label}
              evaluatorName={evaluatorName}
              annotationName={annotation.name}
              output={annotation.output}
              exampleId={row.original.id}
              position={row.index + 1}
              calibrationLabels={row.original.calibrationLabels}
              isRunning={isRunning}
              onViewTracePress={(traceId, projectId, name) => {
                setSelectedTraceInfo({
                  traceId,
                  projectId,
                  evaluatorName: name,
                });
              }}
            />
          ),
          size: 320,
        };
      }

      return {
        id: `instance-${instance.id}`,
        header: () => (
          <PlaygroundInstanceOutputColumnHeader
            instanceId={instance.id}
            index={index}
            experimentId={experimentId}
            isRunning={isRunning}
            evaluatorOutputConfigs={evaluatorOutputConfigs}
          />
        ),

        cell: ({ row }) => {
          return (
            <MemoizedExampleOutputCell
              instanceId={instance.id}
              exampleId={row.original.id}
              isRunning={isRunning}
              datasetExample={{
                input: row.original.input,
                output: row.original.output,
                metadata: row.original.metadata,
              }}
              templateVariablesPath={templateVariablesPath}
              evaluatorOutputConfigs={evaluatorOutputConfigs}
              onViewExperimentRunDetailsPress={() => {
                setSelectedExampleIndex(row.index);
              }}
              onViewTracePress={(traceId, projectId, evaluatorName) => {
                setSelectedTraceInfo({ traceId, projectId, evaluatorName });
              }}
            />
          );
        },
        size: 500,
      };
    });
  }, [
    hasSomeRunIds,
    instances,
    runPlaygroundInstances,
    templateVariablesPath,
    setSelectedExampleIndex,
    evaluatorOutputConfigs,
  ]);

  const runningInstanceIds = useMemo(
    () =>
      instances
        .filter((instance) => instance.activeRunId != null)
        .map((instance) => instance.id),
    [instances]
  );

  const columns: ColumnDef<TableRow>[] = useMemo(
    () => [
      // The row's own column: its number, and the play button that runs
      // every task on just this example.
      {
        id: "row",
        header: () => <VisuallyHidden>Example</VisuallyHidden>,
        size: ROW_COLUMN_WIDTH,
        minSize: ROW_COLUMN_WIDTH,
        enableResizing: false,
        cell: ({ row }) => (
          <PlaygroundExampleRowCell
            exampleId={row.original.id}
            position={row.index + 1}
            runningInstanceIds={runningInstanceIds}
            canRun={!hasSomeRunIds}
            onRun={() =>
              runPlaygroundInstances(undefined, {
                exampleIds: [row.original.id],
              })
            }
          />
        ),
      },
      {
        header: columnLabels.input,
        accessorKey: "input",
        cell: ({ row }) => (
          <ExperimentInputCell
            exampleId={row.original.id}
            externalId={row.original.externalId}
            value={row.original.input}
            height={CELL_PRIMARY_CONTENT_HEIGHT + annotationListHeight}
            onExpand={() => {
              setSearchParams((prev) => {
                prev.set("exampleId", row.original.id);
                return prev;
              });
            }}
          />
        ),
        size: 200,
      },
      {
        header: () => (
          <Flex direction="column" gap="size-50">
            <span>{columnLabels.output}</span>
            <ExperimentCostAndLatencySummary
              executionState="idle"
              isPlaceholder={true}
            />
            <ExperimentAnnotationAggregates
              executionState="idle"
              annotationConfigs={evaluatorOutputConfigs}
              isPlaceholder={true}
            />
          </Flex>
        ),
        accessorKey: "output",
        cell: ({ row }) => (
          <ExperimentReferenceOutputCell
            value={row.original.output}
            height={CELL_PRIMARY_CONTENT_HEIGHT + annotationListHeight}
            label={columnLabels.output}
          />
        ),
        size: 200,
      },
      {
        header: columnLabels.metadata,
        accessorKey: "metadata",
        cell: ({ row }) => {
          const { value, isHidingAnnotations } = getDisplayedMetadata(
            row.original.metadata,
            { hideAnnotations }
          );

          return (
            <ExperimentMetadataCell
              value={value}
              height={CELL_PRIMARY_CONTENT_HEIGHT + annotationListHeight}
              extra={isHidingAnnotations ? <HiddenAnnotationsNotice /> : null}
            />
          );
        },
        size: 200,
      },
      ...playgroundInstanceOutputColumns,
    ],
    [
      columnLabels,
      annotationListHeight,
      evaluatorOutputConfigs,
      hasSomeRunIds,
      hideAnnotations,
      playgroundInstanceOutputColumns,
      runningInstanceIds,
      runPlaygroundInstances,
      setSearchParams,
    ]
  );
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  const estimatedRowHeight = calculateEstimatedRowHeight(numEnabledEvaluators);

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isLoadingNext &&
          hasNext
        ) {
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnSizingInfo,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnSizing,
    columns.length,
    columnVisibility,
  ]);

  return (
    <InstanceVariablesProvider>
      <PlaygroundExpectedOutputsProvider
        datasetId={datasetId}
        getRevisionId={(exampleId) => revisionIdByExampleId.get(exampleId)}
      >
        <PlaygroundExpectedOutputAgentOperation examples={tableData} />
        {apiError && (
          <Alert
            variant="danger"
            banner
            dismissable
            onDismissClick={() => setApiError(null)}
          >
            {apiError}
          </Alert>
        )}
        <PlaygroundExpectedOutputsStatus onReloadExamples={reloadExamples} />
        <div
          css={css`
            flex: 1 1 auto;
            overflow: auto;
            height: 100%;
            scrollbar-gutter: stable;
          `}
          ref={tableContainerCallbackRef}
          onScroll={(e) => fetchMoreOnBottomReached(e.currentTarget)}
        >
          <table
            css={css(tableCSS, borderedTableCSS)}
            style={{
              ...columnSizeVars,
              width: table.getTotalSize(),
              minWidth: "100%",
            }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{
                        width: `calc(var(--header-${header?.id}-size) * 1px)`,
                      }}
                    >
                      <div>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </div>
                      <div
                        {...{
                          onMouseDown: header.getResizeHandler(),
                          onTouchStart: header.getResizeHandler(),
                          className: `resizer ${
                            header.column.getIsResizing() ? "isResizing" : ""
                          }`,
                        }}
                      />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            {isEmpty ? (
              <TableEmpty />
            ) : table.getState().columnSizingInfo.isResizingColumn ? (
              <MemoizedTableBody
                table={table}
                tableContainerRef={tableContainerRef}
                estimatedRowHeight={estimatedRowHeight}
              />
            ) : (
              <TableBody
                table={table}
                tableContainerRef={tableContainerRef}
                estimatedRowHeight={estimatedRowHeight}
              />
            )}
          </table>
          <ViewportModalOverlay
            isOpen={selectedExampleIndex !== null}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setSelectedExampleIndex(null);
              }
            }}
          >
            <ViewportModal size="fullscreen">
              {selectedExampleIndex !== null &&
                exampleIds[selectedExampleIndex] &&
                baseExperimentId != null &&
                isStringArray(compareExperimentIds) && (
                  <ExperimentCompareDetailsDialog
                    datasetId={datasetId}
                    datasetVersionId={datasetVersionId}
                    selectedExampleIndex={selectedExampleIndex}
                    selectedExampleId={tableData[selectedExampleIndex].id}
                    selectedExampleExternalId={
                      tableData[selectedExampleIndex].externalId
                    }
                    baseExperimentId={baseExperimentId}
                    compareExperimentIds={compareExperimentIds}
                    exampleIds={exampleIds}
                    onExampleChange={(exampleIndex) => {
                      if (
                        exampleIndex === exampleIds.length - 1 &&
                        !isLoadingNext &&
                        hasNext
                      ) {
                        loadNext(PAGE_SIZE);
                      }

                      if (
                        exampleIndex >= 0 &&
                        exampleIndex < exampleIds.length
                      ) {
                        setSelectedExampleIndex(exampleIndex);
                      }
                    }}
                    openTraceDialog={(traceId, projectId) => {
                      setSelectedTraceInfo({ traceId, projectId });
                    }}
                  />
                )}
            </ViewportModal>
          </ViewportModalOverlay>
          <ViewportModalOverlay
            isOpen={selectedTraceInfo !== null}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                setSelectedTraceInfo(null);
                setSearchParams(
                  (prev) => {
                    const newParams = new URLSearchParams(prev);
                    newParams.delete(SELECTED_SPAN_NODE_ID_PARAM);

                    return newParams;
                  },
                  { replace: true }
                );
              }
            }}
          >
            <ViewportModal size="fullscreen">
              {selectedTraceInfo && (
                <PlaygroundRunTraceDetailsDialog
                  traceId={selectedTraceInfo.traceId}
                  projectId={selectedTraceInfo.projectId}
                  title={
                    selectedTraceInfo.evaluatorName
                      ? `Evaluator Trace: ${selectedTraceInfo.evaluatorName}`
                      : "Experiment Run Trace"
                  }
                />
              )}
            </ViewportModal>
          </ViewportModalOverlay>
        </div>
      </PlaygroundExpectedOutputsProvider>
    </InstanceVariablesProvider>
  );
}

/**
 * Says that the metadata cell leaves out the `annotations` key, why, and
 * where to turn that off.
 */
function HiddenAnnotationsNotice() {
  return (
    <TooltipTrigger>
      <IconButton
        size="S"
        aria-label={`The "${ANNOTATIONS_KEY}" key is hidden in this cell`}
      >
        <Icon svg={<Icons.Info />} />
      </IconButton>
      <Tooltip>
        <TooltipArrow />
        The &quot;{ANNOTATIONS_KEY}&quot; key is hidden. It holds the expected
        outputs recorded for evaluators. Turn off &quot;Hide expected
        annotations&quot; in the experiment settings to see it.
      </Tooltip>
    </TooltipTrigger>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
graphql`
  subscription PlaygroundDatasetExamplesTableSubscription(
    $input: ExperimentsOverDatasetInput!
  ) {
    experimentsOverDataset(input: $input) {
      __typename
      ... on TextChunk {
        experimentId
        datasetExampleId
        repetitionNumber
        content
      }
      ... on ToolCallChunk {
        experimentId
        datasetExampleId
        repetitionNumber
        id
        function {
          name
          arguments
        }
      }
      ... on ChatCompletionSubscriptionExperiment {
        experimentId
        experiment {
          id
        }
      }
      ... on ChatCompletionSubscriptionResult {
        experimentId
        datasetExampleId
        repetitionNumber
        span {
          id
          tokenCountTotal
          costSummary {
            total {
              cost
            }
          }
          latencyMs
          project {
            id
          }
          context {
            traceId
          }
        }
        experimentRun {
          id
        }
      }
      ... on ChatCompletionSubscriptionError {
        experimentId
        datasetExampleId
        repetitionNumber
        message
        span {
          id
          tokenCountTotal
          costSummary {
            total {
              cost
            }
          }
          latencyMs
          project {
            id
          }
          context {
            traceId
          }
        }
        experimentRun {
          id
        }
      }
      ... on EvaluationChunk {
        experimentId
        datasetExampleId
        repetitionNumber
        evaluatorName
        experimentRunEvaluation {
          id
          name
          label
          score
          annotatorKind
          explanation
          metadata
          startTime
        }
        trace {
          traceId
          projectId
        }
        error
      }
    }
  }
`;
