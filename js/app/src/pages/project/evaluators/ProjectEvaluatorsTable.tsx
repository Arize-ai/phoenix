import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { graphql, readInlineData, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";

import {
  Flex,
  Icon,
  Icons,
  Link,
  LoadMoreButton,
  Text,
  View,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { PythonSVG, TypeScriptSVG } from "@phoenix/components/core/icon/Icons";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import type { TimeRangeISOStrings } from "@phoenix/components/datetime";
import { useTimeRange } from "@phoenix/components/datetime";
import {
  clampTimeRangeToMaxDuration,
  getLastNTimeRangeKeyFromDurationMs,
} from "@phoenix/components/datetime/utils";
import {
  EvaluatorAverageCost,
  EvaluatorCost,
} from "@phoenix/components/evaluators/EvaluatorCost";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import { SandboxConfigLabel } from "@phoenix/components/sandbox/SandboxConfigLabel";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import {
  ACTIONS_COLUMN_ID,
  ColumnHeaderCell,
  ColumnOrderingProvider,
  useColumnOrder,
} from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { ONE_DAY_MS } from "@phoenix/constants/timeConstants";
import { useProjectEvaluatorsTableContext } from "@phoenix/contexts/ProjectEvaluatorsTableContext";
import { useTimeBinScale } from "@phoenix/hooks/useTimeBin";
import { useUTCOffsetMinutes } from "@phoenix/hooks/useUTCOffsetMinutes";
import { PromptCell } from "@phoenix/pages/evaluators/PromptCell";
import type { ProjectEvaluatorsTable_costs$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_costs.graphql";
import type { ProjectEvaluatorsTable_project$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_project.graphql";
import type { ProjectEvaluatorsTable_row$key } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_row.graphql";
import { ProjectEvaluatorActionMenu } from "@phoenix/pages/project/evaluators/ProjectEvaluatorActionMenu";
import { ProjectEvaluatorEnabledSwitch } from "@phoenix/pages/project/evaluators/ProjectEvaluatorEnabledSwitch";
import type { EvaluatorScoreWindow } from "@phoenix/pages/project/evaluators/ProjectEvaluatorMeanScoreCell";
import { ProjectEvaluatorMeanScoreCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorMeanScoreCell";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { ProjectEvaluatorsEmptyState } from "@phoenix/pages/project/evaluators/ProjectEvaluatorsEmptyState";
import { ProjectEvaluatorStatusCell } from "@phoenix/pages/project/evaluators/ProjectEvaluatorStatusCell";
import {
  formatEvaluationTarget,
  formatEvaluationTargetPlural,
  formatSamplingRate,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { getProjectEvaluatorResultAnnotations } from "@phoenix/pages/project/evaluators/useProjectEvaluatorResultAnnotations";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

const PAGE_SIZE = 30;
/**
 * Below this many evaluators, the gallery promo stays visible beneath the
 * table so a project that's just getting started keeps seeing it.
 */
const GALLERY_PROMO_MAX_EVALUATOR_COUNT = 15;
/**
 * The mean score column aggregates over at most this much of the page time
 * range, keeping the per-row annotation scans bounded on long ranges.
 */
const MAX_SCORE_WINDOW_MS = 30 * ONE_DAY_MS;

/** Labels for columns whose header is not a plain string. */
const COLUMN_LABELS: Record<string, string> = {
  meanScore: "mean score",
};

const scrollableAreaCSS = css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`;

const readRow = (
  row: ProjectEvaluatorsTable_row$key & ProjectEvaluatorsTable_costs$key
) => {
  const rowData = readInlineData<ProjectEvaluatorsTable_row$key>(
    graphql`
      fragment ProjectEvaluatorsTable_row on ProjectEvaluator @inline {
        id
        name
        evaluationTarget
        filterCondition
        samplingRate
        schedulabilityStatus
        enabled
        updatedAt
        schedulabilityStatus
        schedulabilityReason
        runSummary {
          status
          lastRunAt
          queuedCount
          evaluatedCount
          failedCount
        }
        # The evaluated project, whose annotations carry the evaluator's scores
        project {
          id
        }
        evaluator {
          kind
          # Selections must cover getProjectEvaluatorResultAnnotations, which
          # resolves the names and optimization metadata of the annotations the
          # evaluator writes for the mean score column.
          outputConfigs {
            ... on AnnotationConfigBase {
              name
              annotationType
            }
            ... on CategoricalAnnotationConfig {
              optimizationDirection
              values {
                label
                score
              }
            }
            ... on ContinuousAnnotationConfig {
              optimizationDirection
              lowerBound
              upperBound
            }
            ... on FreeformAnnotationConfig {
              optimizationDirection
              threshold
              lowerBound
              upperBound
            }
          }
          ... on LLMEvaluator {
            prompt {
              id
              name
            }
            promptVersionTag {
              name
            }
            promptVersion {
              modelName
              modelProvider
            }
          }
          ... on CodeEvaluator {
            language
            sandboxConfig {
              id
              name
              provider {
                backendType
              }
            }
          }
        }
      }
    `,
    row
  );
  const costData = readInlineData<ProjectEvaluatorsTable_costs$key>(
    graphql`
      fragment ProjectEvaluatorsTable_costs on ProjectEvaluator
      @inline
      @argumentDefinitions(timeRange: { type: "TimeRange!" }) {
        # TODO: These aggregate scans may become expensive as evaluator projects grow.
        # Move them onto ProjectEvaluator so CODE evaluators can skip them, and consider @defer.
        traceProject {
          id
          traceCount(timeRange: $timeRange)
          costSummary(timeRange: $timeRange) {
            total {
              cost
            }
            prompt {
              cost
            }
            completion {
              cost
            }
          }
        }
      }
    `,
    row
  );
  return { ...rowData, ...costData };
};

type TableRow = ReturnType<typeof readRow>;

export function ProjectEvaluatorsTable({
  project,
  projectId,
  filter,
  timeRange,
  initialFilter,
  initialTimeRange,
}: {
  project: ProjectEvaluatorsTable_project$key;
  projectId: string;
  /** Free-text name search from the toolbar; empty means unfiltered. */
  filter: string;
  /** Selected project time range used by the cost aggregates. */
  timeRange: TimeRangeISOStrings;
  /** Normalized filter used to fetch the rows supplied by the owner query. */
  initialFilter: string;
  /** Time range used to fetch the rows supplied by the owner query. */
  initialTimeRange: TimeRangeISOStrings;
}) {
  "use no memo";
  const {
    data,
    hasNext,
    isLoadingNext,
    loadNext: _loadNext,
    refetch,
  } = usePaginationFragment(
    graphql`
      fragment ProjectEvaluatorsTable_project on Project
      @refetchable(queryName: "ProjectEvaluatorsTablePaginationQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 30 }
        after: { type: "String", defaultValue: null }
        filter: { type: "ProjectEvaluatorFilter", defaultValue: null }
        timeRange: { type: "TimeRange!" }
      ) {
        evaluators(first: $first, after: $after, filter: $filter)
          @connection(key: "ProjectEvaluatorsTable_evaluators") {
          edges {
            node {
              ...ProjectEvaluatorsTable_row
              ...ProjectEvaluatorsTable_costs @arguments(timeRange: $timeRange)
            }
          }
        }
      }
    `,
    project
  );
  const trimmedFilter = filter.trim();
  const hasComparedInitialQueryInputs = useRef(false);
  // Filtered server-side; a client-side filter would only see the loaded page.
  useEffect(() => {
    if (!hasComparedInitialQueryInputs.current) {
      hasComparedInitialQueryInputs.current = true;
      const hasInitialFilter = trimmedFilter === initialFilter;
      const hasInitialTimeRange =
        timeRange.start === initialTimeRange.start &&
        timeRange.end === initialTimeRange.end;
      // Avoid a duplicate request only when the rows supplied by the owner
      // query already answer the table's current filter and selected range.
      if (hasInitialFilter && hasInitialTimeRange) {
        return;
      }
    }
    startTransition(() => {
      refetch(
        {
          after: null,
          first: PAGE_SIZE,
          filter: trimmedFilter ? { col: "name", value: trimmedFilter } : null,
          timeRange,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [initialFilter, initialTimeRange, trimmedFilter, refetch, timeRange]);
  const loadNext = useCallback(() => {
    _loadNext(PAGE_SIZE, {
      UNSTABLE_extraVariables: {
        filter: trimmedFilter ? { col: "name", value: trimmedFilter } : null,
        timeRange,
      },
    });
  }, [_loadNext, trimmedFilter, timeRange]);
  const tableData = useMemo(
    () => data.evaluators.edges.map(({ node }) => readRow(node)),
    [data.evaluators.edges]
  );
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const openEditSlideover = useCallback(
    (projectEvaluatorId: string) => navigate(paths.edit(projectEvaluatorId)),
    [navigate, paths]
  );
  const { timeRange: pageTimeRange } = useTimeRange();
  const utcOffsetMinutes = useUTCOffsetMinutes();
  // Memoized so an open-ended range resolves "now" once per range change
  // instead of minting new query variables (and refetches) every render.
  const clampedScoreRange = useMemo(
    () =>
      clampTimeRangeToMaxDuration({
        value: pageTimeRange,
        maxDurationMs: MAX_SCORE_WINDOW_MS,
      }),
    [pageTimeRange]
  );
  const scoreBinScale = useTimeBinScale({ timeRange: clampedScoreRange });
  const scoreWindow = useMemo<EvaluatorScoreWindow>(() => {
    const durationMs =
      clampedScoreRange.end.getTime() - clampedScoreRange.start.getTime();
    // An unclamped last-N range echoes its own key ("1d"), since the resolved
    // duration overshoots the label a little (last-N starts snap backward)
    // and would otherwise format as e.g. "25h". Clamped and custom ranges
    // derive the label from the actual window.
    const isClamped =
      pageTimeRange.start == null ||
      clampedScoreRange.start.getTime() > pageTimeRange.start.getTime();
    return {
      timeRange: {
        start: clampedScoreRange.start.toISOString(),
        end: clampedScoreRange.end.toISOString(),
      },
      previousTimeRange: {
        start: new Date(
          clampedScoreRange.start.getTime() - durationMs
        ).toISOString(),
        end: clampedScoreRange.start.toISOString(),
      },
      timeBinConfig: { scale: scoreBinScale, utcOffsetMinutes },
      windowKey:
        !isClamped && pageTimeRange.timeRangeKey !== "custom"
          ? pageTimeRange.timeRangeKey
          : getLastNTimeRangeKeyFromDurationMs(durationMs),
    };
  }, [clampedScoreRange, pageTimeRange, scoreBinScale, utcOffsetMinutes]);
  const columns = useMemo<ColumnDef<TableRow>[]>(
    () => [
      {
        header: "name",
        size: 200,
        accessorKey: "name",
        cell: ({ getValue, row }) => (
          <Link to={paths.details(row.original.id)}>
            <Truncate maxWidth="100%">{getValue() as string}</Truncate>
          </Link>
        ),
      },
      {
        id: "status",
        header: "status",
        size: 130,
        cell: ({ row }) => (
          <ProjectEvaluatorStatusCell
            schedulabilityStatus={row.original.schedulabilityStatus}
            schedulabilityReason={row.original.schedulabilityReason}
            runSummary={row.original.runSummary}
          />
        ),
      },
      {
        id: "kind",
        header: "kind",
        size: 80,
        cell: ({ row }) => (
          <EvaluatorKindToken kind={row.original.evaluator.kind} />
        ),
      },
      {
        id: "meanScore",
        header: () => (
          <Flex direction="row" gap="size-50" alignItems="baseline">
            <span title="Mean score of the annotations this evaluator produced in the selected time range (at most the last 30 days), with the change vs. the previous window.">
              mean score
            </span>
            <Text size="XS" fontFamily="mono" color="text-500">
              {scoreWindow.windowKey}
            </Text>
          </Flex>
        ),
        size: 170,
        cell: ({ row }) => (
          <ProjectEvaluatorMeanScoreCell
            projectId={row.original.project.id}
            evaluationTarget={row.original.evaluationTarget}
            annotations={getProjectEvaluatorResultAnnotations({
              name: row.original.name,
              outputConfigs: row.original.evaluator.outputConfigs,
            })}
            scoreWindow={scoreWindow}
          />
        ),
      },
      {
        id: "prompt",
        header: "prompt",
        size: 180,
        cell: ({ row }) => {
          const { prompt, promptVersionTag } = row.original.evaluator;
          if (!prompt) {
            return <Text color="text-700">—</Text>;
          }
          return (
            <PromptCell
              prompt={prompt}
              promptVersionTag={promptVersionTag?.name}
            />
          );
        },
      },
      {
        id: "model",
        header: "model",
        size: 180,
        cell: ({ row }) => {
          const promptVersion = row.original.evaluator.promptVersion;
          if (!promptVersion) {
            return <Text color="text-700">—</Text>;
          }
          const { modelName, modelProvider } = promptVersion;
          const providerIsValid = isModelProvider(modelProvider);
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              {providerIsValid && (
                <GenerativeProviderIcon provider={modelProvider} height={16} />
              )}
              <Text minWidth={0}>
                <Truncate>{modelName}</Truncate>
              </Text>
            </Flex>
          );
        },
      },
      {
        id: "cost",
        header: "total cost",
        size: 120,
        meta: { textAlign: "right" },
        cell: ({ row }) => (
          <EvaluatorCost
            evaluatorKind={row.original.evaluator.kind}
            costSummary={row.original.traceProject.costSummary}
          />
        ),
      },
      {
        id: "averageCost",
        header: "avg cost / run",
        size: 200,
        meta: { textAlign: "right" },
        cell: ({ row }) => (
          <EvaluatorAverageCost
            evaluatorKind={row.original.evaluator.kind}
            costSummary={row.original.traceProject.costSummary}
            runCount={row.original.traceProject.traceCount}
          />
        ),
      },
      {
        id: "language",
        header: "language",
        size: 110,
        cell: ({ row }) => {
          const language = row.original.evaluator.language;
          if (!language) {
            return <Text color="text-700">—</Text>;
          }
          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              {language === "PYTHON" ? <PythonSVG /> : <TypeScriptSVG />}
              <Text>{language === "PYTHON" ? "Python" : "TypeScript"}</Text>
            </Flex>
          );
        },
      },
      {
        id: "sandbox",
        header: "sandbox",
        size: 160,
        cell: ({ row }) => {
          const sandboxConfig = row.original.evaluator.sandboxConfig;
          if (!sandboxConfig) {
            return <Text color="text-700">—</Text>;
          }
          return (
            <SandboxConfigLabel
              sandboxConfigId={sandboxConfig.id}
              name={sandboxConfig.name}
              backendType={sandboxConfig.provider.backendType}
            />
          );
        },
      },
      {
        id: "target",
        header: "target",
        size: 110,
        // A disabled evaluator already reads as not running from its own
        // column, so only flag scope-driven reasons here.
        cell: ({ row }) => (
          <Flex direction="row" gap="size-100" alignItems="center">
            <Text>{formatEvaluationTarget(row.original.evaluationTarget)}</Text>
            {row.original.enabled &&
            row.original.schedulabilityStatus === "NOT_SCHEDULABLE" ? (
              <span title="This evaluator is not scheduled.">
                <Icon svg={<Icons.AlertTriangle />} color="warning" />
              </span>
            ) : null}
          </Flex>
        ),
      },
      {
        id: "filter",
        header: "filter",
        size: 180,
        cell: ({ row }) => (
          <Text color={row.original.filterCondition ? undefined : "text-700"}>
            {row.original.filterCondition ||
              `All ${formatEvaluationTargetPlural(row.original.evaluationTarget)}`}
          </Text>
        ),
      },
      {
        id: "sampling",
        header: "sampling",
        size: 100,
        cell: ({ row }) => formatSamplingRate(row.original.samplingRate),
      },
      {
        id: "updatedAt",
        header: "last updated",
        size: 160,
        accessorKey: "updatedAt",
        cell: TimestampCell,
      },
      {
        id: "enabled",
        header: "enabled",
        size: 90,
        cell: ({ row }) => (
          <StopPropagation>
            <ProjectEvaluatorEnabledSwitch
              projectEvaluatorId={row.original.id}
              name={row.original.name}
              enabled={row.original.enabled}
            />
          </StopPropagation>
        ),
      },
      {
        id: ACTIONS_COLUMN_ID,
        header: "actions",
        size: 80,
        cell: ({ row }) => (
          <ProjectEvaluatorActionMenu
            projectEvaluatorId={row.original.id}
            projectId={projectId}
            evaluatorKind={row.original.evaluator.kind}
            evaluatorName={row.original.name}
            onEdit={openEditSlideover}
          />
        ),
      },
    ],
    [projectId, openEditSlideover, paths, scoreWindow]
  );
  const columnVisibility = useProjectEvaluatorsTableContext(
    (state) => state.columnVisibility
  );
  const setColumnVisibility = useProjectEvaluatorsTableContext(
    (state) => state.setColumnVisibility
  );
  const columnSizing = useProjectEvaluatorsTableContext(
    (state) => state.columnSizing
  );
  const setColumnSizing = useProjectEvaluatorsTableContext(
    (state) => state.setColumnSizing
  );
  const storedColumnOrder = useProjectEvaluatorsTableContext(
    (state) => state.columnOrder
  );
  const setColumnOrder = useProjectEvaluatorsTableContext(
    (state) => state.setColumnOrder
  );
  const {
    leafColumnOrder,
    visibleColumnOrder,
    onVisibleColumnOrderChange,
    getColumnOrderIndex,
  } = useColumnOrder({
    columns,
    columnOrder: storedColumnOrder,
    onColumnOrderChange: setColumnOrder,
    columnVisibility,
    // The pinned columns keep their place on the table's right edge
    nonOrderableColumnIds: ["enabled", ACTIONS_COLUMN_ID],
  });
  const table = useReactTable({
    columns,
    data: tableData,
    state: {
      columnPinning: {
        right: ["enabled", ACTIONS_COLUMN_ID],
      },
      columnSizing,
      columnVisibility,
      columnOrder: leafColumnOrder,
    },
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const { columnSizingInfo } = table.getState();
  const getFlatHeaders = table.getFlatHeaders;
  /**
   * Calculate all column sizes at once at the root table level
   * and pass them down as CSS variables to the <table> element.
   * This avoids calling `column.getSize()` on every render for every cell.
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const columnSizeVars = useMemo(() => {
    const headers = getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // Disabled lint as per tanstack docs linked above

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizing]);
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const isFiltered = trimmedFilter.length > 0;
  if (isEmpty && !isFiltered) {
    return (
      <div css={scrollableAreaCSS}>
        <ProjectEvaluatorsEmptyState />
      </div>
    );
  }
  // hasNext means more evaluators exist beyond this page, so rows.length is
  // only the true total once the full connection has loaded.
  const showGalleryPromo =
    !isFiltered && !hasNext && rows.length < GALLERY_PROMO_MAX_EVALUATOR_COUNT;
  return (
    <div css={scrollableAreaCSS}>
      <ColumnOrderingProvider
        columnOrder={visibleColumnOrder}
        onColumnOrderChange={onVisibleColumnOrderChange}
      >
        <table
          css={selectableTableCSS}
          aria-label="Project evaluators"
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
                  <ColumnHeaderCell
                    key={header.id}
                    colSpan={header.colSpan}
                    columnId={header.column.id}
                    index={getColumnOrderIndex(header.column.id)}
                    label={
                      typeof header.column.columnDef.header === "string"
                        ? header.column.columnDef.header
                        : COLUMN_LABELS[header.column.id]
                    }
                    style={{
                      width: `calc(var(--header-${header.id}-size) * 1px)`,
                      ...(header.column.getIsPinned()
                        ? {
                            ...getCommonPinningStyles(header.column),
                            zIndex: 3,
                          }
                        : {}),
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          style={{
                            textAlign: header.column.columnDef.meta?.textAlign,
                          }}
                        >
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
                      </>
                    )}
                  </ColumnHeaderCell>
                ))}
              </tr>
            ))}
          </thead>
          {isEmpty ? (
            <TableEmptyWrap>
              <CompactEmptyState
                icon={<Icon svg={<Icons.Scale />} />}
                description="No evaluators"
                isFiltered={isFiltered}
              />
            </TableEmptyWrap>
          ) : (
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(paths.details(row.original.id))}
                >
                  {row.getVisibleCells().map((cell) => {
                    const colSizeVar = `--col-${cell.column.id}-size`;
                    return (
                      <td
                        key={cell.id}
                        style={{
                          width: `calc(var(${colSizeVar}) * 1px)`,
                          maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          textAlign: cell.column.columnDef.meta?.textAlign,
                          ...(cell.column.getIsPinned()
                            ? getCommonPinningStyles(cell.column)
                            : {}),
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </ColumnOrderingProvider>
      {hasNext ? (
        <View padding="size-100">
          <Flex justifyContent="center">
            <LoadMoreButton
              isLoadingNext={isLoadingNext}
              onLoadMore={loadNext}
            />
          </Flex>
        </View>
      ) : null}
      {showGalleryPromo ? (
        <View borderTopWidth="thin" borderTopColor="default">
          <ProjectEvaluatorsEmptyState />
        </View>
      ) : null}
    </div>
  );
}
