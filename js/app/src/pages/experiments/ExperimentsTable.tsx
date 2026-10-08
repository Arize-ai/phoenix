import { css } from "@emotion/react";
import type { ColumnDef, Table } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  memo,
  startTransition,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import { Cell, Pie, PieChart } from "recharts";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  Link,
  LinkButton,
  OverflowRow,
  ProgressBar,
  RichTooltip,
  Text,
  Token,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import type { AnnotationConfig } from "@phoenix/components/annotation";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
import { CopyToClipboardButton } from "@phoenix/components/core/copy/CopyToClipboardButton";
import { DebouncedSearch } from "@phoenix/components/core/field/DebouncedSearch";
import { ProgressCircle } from "@phoenix/components/core/progress";
import {
  RichTooltipActions,
  RichTooltipDescription,
  RichTooltipTitle,
} from "@phoenix/components/core/tooltip";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import {
  BaselineExperimentBadge,
  ExperimentStatus,
  ExperimentTokenCount,
  SequenceNumberToken,
} from "@phoenix/components/experiment";
import { ExperimentActionMenu } from "@phoenix/components/experiment/ExperimentActionMenu";
import {
  indexAnnotationConfigsByName,
  indexSummariesByAnnotationName,
} from "@phoenix/components/experiment/experimentDeltaUtils";
import type { ExperimentRunMetric } from "@phoenix/components/experiment/experimentDeltaUtils";
import {
  ExperimentAnnotationMeanDelta,
  ExperimentMetricCell,
  ExperimentRunMetricDelta,
} from "@phoenix/components/experiment/ExperimentMetricDelta";
import { ExperimentTokenCosts } from "@phoenix/components/experiment/ExperimentTokenCosts";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import {
  ColumnHeaderCell,
  ColumnOrderingProvider,
  CompactJSONCell,
  createRowSelectionColumn,
  IntCell,
  LoadMoreRow,
  RowExpandToggleButton,
  TableViewSettingsButton,
  useColumnOrder,
  useTableRowsExpanded,
} from "@phoenix/components/table";
import { CellWithControlsWrap } from "@phoenix/components/table/CellWithControlsWrap";
import {
  CHECKBOX_COLUMN_ID,
  CHECKBOX_COLUMN_PINNING,
} from "@phoenix/components/table/constants";
import {
  expandableSelectableTableCSS,
  getCommonPinningStyles,
  TABLE_DATA_CELL_CLASS,
} from "@phoenix/components/table/styles";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useShiftClickRowSelection } from "@phoenix/components/table/useShiftClickRowSelection";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { EXPERIMENTS_TABLE_STORAGE_KEY_PREFIX } from "@phoenix/constants/storageConstants";
import { usePersistedState } from "@phoenix/hooks";
import { useInterval } from "@phoenix/hooks/useInterval";
import { useWordColor } from "@phoenix/hooks/useWordColor";
import { calculateAnnotationScorePercentile } from "@phoenix/pages/experiment/utils";
import { datasetEvaluatorsToAnnotationConfigs } from "@phoenix/utils/datasetEvaluatorUtils";
import {
  floatFormatter,
  formatPercent,
  intFormatter,
} from "@phoenix/utils/numberFormatUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type {
  ExperimentsTableFragment$data,
  ExperimentsTableFragment$key,
} from "./__generated__/ExperimentsTableFragment.graphql";
import type { ExperimentsTableQuery } from "./__generated__/ExperimentsTableQuery.graphql";
import { ACTIONS_COLUMN_ID, ANNOTATION_COLUMN_PREFIX } from "./constants";
import { DownloadExperimentActionMenu } from "./DownloadExperimentActionMenu";
import { ErrorRateText } from "./ErrorRateText";
import { ExperimentColumnSelector } from "./ExperimentColumnSelector";
import { useExperimentsDeltasViewSetting } from "./experimentsDeltasViewSetting";
import { ExperimentSelectionToolbar } from "./ExperimentSelectionToolbar";
import { useExperimentsMetricChartsViewSetting } from "./ExperimentsMetricsCharts";
import { ExperimentsMetricsChartSelector } from "./ExperimentsMetricsChartSelector";

const PAGE_SIZE = 100;

/**
 * Poll interval for refetching experiment data when experiments are running
 */
const RUNNING_EXPERIMENTS_POLL_INTERVAL_MS = 3000;

const defaultColumnSettings = {
  minSize: 100,
} satisfies Partial<ColumnDef<unknown>>;

/**
 * Explains, for a column that shows a total, that its delta compares per-run
 * averages so experiments with different run counts line up.
 */
const PER_RUN_DELTA_NOTE = "Compared per run: total divided by run count";

/** The width of the bar that places a mean score between the column's min and max */
const ANNOTATION_BAR_WIDTH = "40px";

const annotationBarSlotCSS = css`
  display: inline-block;
  width: ${ANNOTATION_BAR_WIDTH};
`;

const TableBody = <T extends { id: string }>({
  table,
  hasNext,
  onLoadNext,
  isLoadingNext,
  dataset,
}: {
  table: Table<T>;
  hasNext: boolean;
  onLoadNext: () => void;
  isLoadingNext: boolean;
  dataset: ExperimentsTableFragment$data;
}) => {
  "use no memo";
  const navigate = useNavigate();
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => {
        return (
          <tr
            key={row.id}
            onClick={() => {
              navigate(
                `/datasets/${dataset.id}/compare?experimentId=${row.original.id}`
              );
            }}
          >
            {row.getVisibleCells().map((cell) => {
              const colSizeVar = `--col-${makeSafeColumnId(cell.column.id)}-size`;
              return (
                <td
                  key={cell.id}
                  className={TABLE_DATA_CELL_CLASS}
                  align={cell.column.columnDef.meta?.textAlign}
                  style={{
                    ...getCommonPinningStyles(cell.column),
                    width: `calc(var(${colSizeVar}) * 1px)`,
                    maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                    userSelect:
                      cell.column.id === CHECKBOX_COLUMN_ID
                        ? "none"
                        : undefined,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
      {hasNext ? (
        <LoadMoreRow
          onLoadMore={onLoadNext}
          key="load-more"
          isLoadingNext={isLoadingNext}
        />
      ) : null}
    </tbody>
  );
};

// Memoized wrapper for table body to use during column resizing
export const MemoizedTableBody = memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

export function ExperimentsTable({
  dataset,
}: {
  dataset: ExperimentsTableFragment$key;
}) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [, setSearchText] = useState("");
  const {
    isExpanded: areRowsExpanded,
    setIsExpanded: setAreRowsExpanded,
    tableProps: rowsExpandedTableProps,
  } = useTableRowsExpanded();
  const chartsViewSetting = useExperimentsMetricChartsViewSetting();
  const deltasViewSetting = useExperimentsDeltasViewSetting();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<ExperimentsTableQuery, ExperimentsTableFragment$key>(
      graphql`
        fragment ExperimentsTableFragment on Dataset
        @refetchable(queryName: "ExperimentsTableQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
        ) {
          id
          experimentAnnotationSummaries {
            annotationName
            minScore
            maxScore
          }
          baselineExperiment {
            id
            runCount
            averageRunLatencyMs
            errorRate
            costSummary {
              total {
                tokens
                cost
              }
            }
            annotationSummaries {
              annotationName
              meanScore
            }
          }
          datasetEvaluators(first: 100) {
            edges {
              node {
                name
                outputConfigs {
                  __typename
                  ... on CategoricalAnnotationConfig {
                    name
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    optimizationDirection
                    lowerBound
                    upperBound
                  }
                  ... on FreeformAnnotationConfig {
                    name
                    optimizationDirection
                    threshold
                    lowerBound
                    upperBound
                  }
                }
              }
            }
          }
          experiments(first: $first, after: $after)
            @connection(key: "ExperimentsTable_experiments") {
            edges {
              experiment: node {
                id
                name
                sequenceNumber
                description
                isBaseline
                createdAt
                metadata
                errorRate
                runCount
                expectedRunCount
                repetitions
                averageRunLatencyMs
                project {
                  id
                }
                datasetSplits {
                  edges {
                    node {
                      id
                      name
                      color
                    }
                  }
                }
                costSummary {
                  total {
                    tokens
                    cost
                  }
                  prompt {
                    tokens
                    cost
                  }
                  completion {
                    tokens
                    cost
                  }
                }
                annotationSummaries {
                  annotationName
                  meanScore
                  count
                  errorCount
                }
                user {
                  username
                  profilePictureUrl
                }
                job {
                  status
                }
              }
            }
          }
        }
      `,
      dataset
    );
  const [columnVisibility, setColumnVisibility] = usePersistedState<
    Record<string, boolean>
  >(`${EXPERIMENTS_TABLE_STORAGE_KEY_PREFIX}visibility-${data.id}`, {
    id: false,
    experimentJobStatus: false,
    experimentJobProgress: false,
  });
  const [columnSizing, setColumnSizing] = usePersistedState<
    Record<string, number>
  >(`${EXPERIMENTS_TABLE_STORAGE_KEY_PREFIX}sizing-${data.id}`, {});
  const [storedColumnOrder, setStoredColumnOrder] = usePersistedState<string[]>(
    `${EXPERIMENTS_TABLE_STORAGE_KEY_PREFIX}order-${data.id}`,
    []
  );

  const tableData = useMemo(
    () =>
      data.experiments.edges.map((edge) => {
        const annotationSummaryMap = edge.experiment.annotationSummaries.reduce<
          Record<
            string,
            | {
                annotationName: string;
                meanScore: number | null;
                annotatedCount: number;
                totalRunCount: number;
              }
            | undefined
          >
        >((acc, summary) => {
          const totalRunCount = edge.experiment.runCount;
          const annotatedCount = summary.count - summary.errorCount;
          acc[summary.annotationName] = {
            ...summary,
            annotatedCount,
            totalRunCount,
          };
          return acc;
        }, {});
        return {
          ...edge.experiment,
          annotationSummaryMap,
        };
      }),
    [data.experiments.edges]
  );

  const hasRunningExperiments = useMemo(
    () => tableData.some((row) => row.job?.status === "RUNNING"),
    [tableData]
  );

  useInterval(
    () => {
      startTransition(() => {
        refetch({}, { fetchPolicy: "store-and-network" });
      });
    },
    hasRunningExperiments ? RUNNING_EXPERIMENTS_POLL_INTERVAL_MS : null
  );

  type TableRow = (typeof tableData)[number];
  const baselineExperiment = data.baselineExperiment;
  const baselineSummaryByAnnotationName = indexSummariesByAnnotationName(
    baselineExperiment?.annotationSummaries
  );
  const annotationConfigByName = indexAnnotationConfigsByName(
    datasetEvaluatorsToAnnotationConfigs(
      data.datasetEvaluators.edges.map((edge) => edge.node)
    )
  );
  /**
   * Whether the numeric columns hold a delta slot: a baseline is set and the
   * deltas are shown. The baseline row keeps the slot empty so its values
   * line up with the other rows.
   */
  const hasDeltaSlot =
    deltasViewSetting.isEnabled && baselineExperiment != null;
  /**
   * The baseline to show a row's deltas against: none for the baseline row
   * itself, when no baseline is set, or when deltas are hidden.
   */
  const getRowDeltaBaseline = (row: TableRow) =>
    hasDeltaSlot && baselineExperiment.id !== row.id
      ? baselineExperiment
      : null;
  /**
   * A row's delta token for a per-run metric, or nothing when the row has no
   * baseline to compare against.
   */
  const renderRunMetricDelta = ({
    row,
    metric,
    note,
  }: {
    row: TableRow;
    metric: ExperimentRunMetric;
    note?: string;
  }) => {
    const baseline = getRowDeltaBaseline(row);
    return baseline ? (
      <ExperimentRunMetricDelta
        metric={metric}
        experiment={row}
        baseExperiment={baseline}
        note={note}
        tooltipPlacement="top"
        variant="tabular"
      />
    ) : undefined;
  };

  const { selectRow } = useShiftClickRowSelection<TableRow>({
    resetKey: tableData,
  });

  const baseColumns: ColumnDef<TableRow>[] = [
    createRowSelectionColumn<TableRow>({
      selectRow,
      size: 50,
      minSize: 50,
      maxSize: 50,
    }),
    {
      header: "id",
      id: "id",
      accessorKey: "id",
      enableSorting: false,
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return (
          <CellWithControlsWrap
            controls={<CopyToClipboardButton text={value} />}
          >
            <Truncate>
              <Text>{value}</Text>
            </Truncate>
          </CellWithControlsWrap>
        );
      },
    },
    {
      header: "name",
      accessorKey: "name",
      minSize: 200,
      cell: ({ getValue, row }) => {
        const experimentId = row.original.id;
        const sequenceNumber = row.original.sequenceNumber;
        const jobStatus = row.original.job?.status;
        const isBaseline = row.original.isBaseline;
        return (
          <Flex direction="row" gap="size-100" alignItems="center">
            <SequenceNumberToken sequenceNumber={sequenceNumber} />
            <Link
              to={`/datasets/${data.id}/compare?experimentId=${experimentId}`}
            >
              <Truncate maxWidth="100%">{getValue() as string}</Truncate>
            </Link>
            <ExperimentJobStatusIcon
              status={jobStatus}
              experimentId={experimentId}
              datasetId={data.id}
            />
            {isBaseline ? (
              <span style={{ marginInlineStart: "auto" }}>
                <BaselineExperimentBadge size="M" />
              </span>
            ) : null}
          </Flex>
        );
      },
    },
    {
      header: "user",
      accessorKey: "user",
      cell: ({ row }) => {
        const user = row.original.user;
        return (
          <Flex direction="row" gap="size-100" alignItems="center">
            <UserPicture
              name={user?.username}
              profilePictureUrl={user?.profilePictureUrl}
              size={20}
            />
            <Text>{user?.username ?? "system"}</Text>
          </Flex>
        );
      },
    },
    {
      header: "description",
      accessorKey: "description",
      minSize: 300,
      cell: TextCell,
    },
    {
      header: "created at",
      accessorKey: "createdAt",
      minSize: 200,
      cell: TimestampCell,
    },
    {
      header: "splits",
      accessorKey: "datasetSplits",
      cell: ({ row }) => {
        const datasetSplits = row.original.datasetSplits;
        if (!datasetSplits || datasetSplits.edges.length === 0) {
          return <>all examples</>;
        }
        return (
          <OverflowRow isExpanded={areRowsExpanded}>
            {datasetSplits.edges.map((edge) => (
              <Token key={edge.node.id} color={edge.node.color}>
                {edge.node.name}
              </Token>
            ))}
          </OverflowRow>
        );
      },
    },
  ];

  const annotationColumns: ColumnDef<TableRow>[] =
    data.experimentAnnotationSummaries.map((annotationSummary) => {
      const { annotationName, minScore, maxScore } = annotationSummary;
      return {
        header: () => (
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            justifyContent="end"
          >
            <Text>{annotationName}</Text>
            <AnnotationColorSwatch annotationName={annotationName} />
          </Flex>
        ),
        id: `${ANNOTATION_COLUMN_PREFIX}${annotationName}`,
        meta: { textAlign: "right" },
        cell: ({ row }) => {
          const annotation = row.original.annotationSummaryMap[annotationName];
          if (!annotation || annotation.meanScore == null) {
            return (
              <ExperimentMetricCell
                value="--"
                bar={<span css={annotationBarSlotCSS} />}
                hasDeltaSlot={hasDeltaSlot}
              />
            );
          }
          const rowBaseline = getRowDeltaBaseline(row.original);
          return (
            <AnnotationAggregationCell
              annotationName={annotationName}
              value={annotation.meanScore}
              min={minScore}
              max={maxScore}
              annotatedCount={annotation.annotatedCount}
              totalRunCount={annotation.totalRunCount}
              baselineMeanScore={
                rowBaseline
                  ? (baselineSummaryByAnnotationName[annotationName]
                      ?.meanScore ?? null)
                  : undefined
              }
              config={annotationConfigByName[annotationName]}
              hasDeltaSlot={hasDeltaSlot}
            />
          );
        },
      };
    });

  const tailColumns: ColumnDef<TableRow>[] = [
    {
      header: "repetitions",
      accessorKey: "repetitions",
      meta: { textAlign: "right" },
      cell: IntCell,
    },
    {
      header: "run count",
      accessorKey: "runCount",
      meta: { textAlign: "right" },
      cell: IntCell,
    },
    {
      header: "experiment job",
      columns: [
        {
          header: "job status",
          id: "experimentJobStatus",
          cell: ({ row }) => (
            <ExperimentStatus status={row.original.job?.status} />
          ),
        },
        {
          header: "job progress",
          id: "experimentJobProgress",
          minSize: 200,
          cell: ({ row }) => {
            const { runCount, expectedRunCount } = row.original;
            const progressValue =
              expectedRunCount > 0 ? (runCount / expectedRunCount) * 100 : 0;
            return (
              <Flex
                direction="row"
                gap="size-100"
                alignItems="center"
                justifyContent="end"
              >
                <span className="font-mono">
                  {intFormatter(runCount)} / {intFormatter(expectedRunCount)}
                </span>
                <ProgressBar
                  width="60px"
                  value={progressValue}
                  aria-label="job progress"
                />
              </Flex>
            );
          },
        },
      ],
    },
    {
      header: "avg latency",
      accessorKey: "averageRunLatencyMs",
      meta: { textAlign: "right" },
      cell: ({ getValue, row }) => {
        const value = getValue();
        const hasValue = typeof value === "number";
        return (
          <ExperimentMetricCell
            value={hasValue ? <LatencyText latencyMs={value} size="S" /> : "--"}
            delta={
              hasValue
                ? renderRunMetricDelta({ row: row.original, metric: "latency" })
                : undefined
            }
            hasDeltaSlot={hasDeltaSlot}
          />
        );
      },
    },
    {
      header: "total cost",
      accessorKey: "costSummary.total.cost",
      meta: { textAlign: "right" },
      cell: ({ getValue, row }) => {
        const value = getValue() as number | null;
        return (
          <ExperimentMetricCell
            value={
              value != null ? (
                <ExperimentTokenCosts
                  totalCost={value}
                  experimentId={row.original.id}
                />
              ) : (
                "--"
              )
            }
            delta={
              value != null
                ? renderRunMetricDelta({
                    row: row.original,
                    metric: "cost",
                    note: PER_RUN_DELTA_NOTE,
                  })
                : undefined
            }
            hasDeltaSlot={hasDeltaSlot}
          />
        );
      },
    },
    {
      header: "total tokens",
      accessorKey: "costSummary.total.tokens",
      meta: { textAlign: "right" },
      cell: ({ getValue, row }) => {
        const value = getValue() as number | null;
        return (
          <ExperimentMetricCell
            value={
              <ExperimentTokenCount
                tokenCountTotal={value}
                experimentId={row.original.id}
                size="S"
              />
            }
            delta={
              value != null
                ? renderRunMetricDelta({
                    row: row.original,
                    metric: "tokens",
                    note: PER_RUN_DELTA_NOTE,
                  })
                : undefined
            }
            hasDeltaSlot={hasDeltaSlot}
          />
        );
      },
    },
    {
      header: "error rate",
      accessorKey: "errorRate",
      meta: { textAlign: "right" },
      cell: ({ row }) => (
        <ExperimentMetricCell
          value={<ErrorRateText errorRate={row.original.errorRate} />}
          delta={renderRunMetricDelta({
            row: row.original,
            metric: "errorRate",
          })}
          hasDeltaSlot={hasDeltaSlot}
        />
      ),
    },
    {
      header: "metadata",
      accessorKey: "metadata",
      minSize: 200,
      cell: CompactJSONCell,
    },
    {
      id: ACTIONS_COLUMN_ID,
      minSize: 180,
      cell: ({ row }) => {
        const project = row.original.project;
        const metadata = row.original.metadata;
        return (
          <StopPropagation>
            <Flex direction="row" gap="size-100">
              {project?.id ? (
                <LinkButton
                  to={`/projects/${project?.id}`}
                  leadingVisual={<Icon svg={<Icons.Trace />} />}
                  size="S"
                  aria-label="View traces"
                  isDisabled={!project?.id}
                >
                  Traces
                </LinkButton>
              ) : null}
              <DownloadExperimentActionMenu experimentId={row.original.id} />

              <ExperimentActionMenu
                projectId={project?.id || null}
                experimentId={row.original.id}
                canSetBaseline
                isBaseline={row.original.isBaseline}
                metadata={metadata}
                jobStatus={row.original.job?.status ?? null}
                size="S"
                canEditExperiment
                experimentName={row.original.name}
                experimentDescription={row.original.description ?? null}
                canDeleteExperiment={true}
                onExperimentDeleted={() => {
                  refetch({}, { fetchPolicy: "network-only" });
                }}
              />
            </Flex>
          </StopPropagation>
        );
      },
    },
  ];

  const columns = [...baseColumns, ...annotationColumns, ...tailColumns];
  const {
    leafColumnOrder,
    visibleColumnOrder,
    onVisibleColumnOrderChange,
    getColumnOrderIndex,
  } = useColumnOrder({
    columns,
    columnOrder: storedColumnOrder,
    onColumnOrderChange: setStoredColumnOrder,
    columnVisibility,
    // The checkbox and the pinned actions column stay at the edges
    nonOrderableColumnIds: [CHECKBOX_COLUMN_ID, ACTIONS_COLUMN_ID],
  });

  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      rowSelection,
      columnSizing,
      columnVisibility,
      columnOrder: leafColumnOrder,
      columnPinning: {
        ...CHECKBOX_COLUMN_PINNING,
        right: [ACTIONS_COLUMN_ID],
      },
    },
    defaultColumn: defaultColumnSettings,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    // Key rows by entity ID rather than by index so that row-hosted overlays
    // (action menus) and row selection stay bound to the row they were opened
    // on when a refetch re-orders the list.
    getRowId: (row) => row.id,
  });

  const selectorColumns = table.getAllColumns();

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedExperiments = selectedRows.map((row) => row.original);
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);

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

  const { columnSizingInfo, columnSizing: columnSizingState } =
    table.getState();
  const getFlatHeaders = table.getFlatHeaders;

  /**
   * Calculate all column sizes at once as CSS variables for performance
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const [columnSizeVars] = useMemo(() => {
    const headers = getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${makeSafeColumnId(header.id)}-size`] =
        header.getSize();
      colSizes[`--col-${makeSafeColumnId(header.column.id)}-size`] =
        header.column.getSize();
    }
    return [colSizes];
    // Disabled lint as per tanstack docs linked above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizingState]);

  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      `}
    >
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-200"
        paddingEnd="size-200"
        borderBottomColor="default"
        borderBottomWidth="thin"
        flex="none"
      >
        <Flex direction="row" gap="size-100" width="100%" alignItems="center">
          <View flex="1 1 auto">
            <DebouncedSearch
              placeholder="Search experiments"
              aria-label="Search experiments"
              onChange={setSearchText}
            />
          </View>
          <ExperimentsMetricsChartSelector />
          <ExperimentColumnSelector
            columns={selectorColumns}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            columnOrder={storedColumnOrder}
            onColumnOrderChange={setStoredColumnOrder}
          />
          <RowExpandToggleButton
            isExpanded={areRowsExpanded}
            onChange={setAreRowsExpanded}
          />
          <TableViewSettingsButton
            settings={
              baselineExperiment
                ? [chartsViewSetting, deltasViewSetting]
                : [chartsViewSetting]
            }
          />
        </Flex>
      </View>
      <div
        css={css`
          flex: 1 1 auto;
          overflow: auto;
        `}
        ref={tableContainerRef}
        onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
      >
        <ColumnOrderingProvider
          columnOrder={visibleColumnOrder}
          onColumnOrderChange={onVisibleColumnOrderChange}
        >
          <table
            css={expandableSelectableTableCSS}
            {...rowsExpandedTableProps}
            style={{
              ...columnSizeVars,
              width: table.getTotalSize(),
              minWidth: "100%",
            }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup, headerGroupIndex) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <ColumnHeaderCell
                      key={header.id}
                      columnId={header.column.id}
                      // Only the top header group is reorderable; sub-headers
                      // of a group column move with it
                      index={
                        headerGroupIndex === 0
                          ? getColumnOrderIndex(header.column.id)
                          : -1
                      }
                      label={
                        typeof header.column.columnDef.header === "string"
                          ? header.column.columnDef.header
                          : undefined
                      }
                      colSpan={header.colSpan}
                      align={header.column.columnDef.meta?.textAlign}
                      style={{
                        ...getCommonPinningStyles(header.column),
                        width: `calc(var(--header-${makeSafeColumnId(header.id)}-size) * 1px)`,
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <>
                          <div>
                            <Truncate maxWidth="100%">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </Truncate>
                          </div>
                          <div
                            {...{
                              onMouseDown: header.getResizeHandler(),
                              onTouchStart: header.getResizeHandler(),
                              className: `resizer ${
                                header.column.getIsResizing()
                                  ? "isResizing"
                                  : ""
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
            {columnSizingInfo.isResizingColumn ? (
              <MemoizedTableBody
                table={table}
                hasNext={hasNext}
                onLoadNext={() => loadNext(PAGE_SIZE)}
                isLoadingNext={isLoadingNext}
                dataset={data}
              />
            ) : (
              <TableBody
                table={table}
                hasNext={hasNext}
                onLoadNext={() => loadNext(PAGE_SIZE)}
                isLoadingNext={isLoadingNext}
                dataset={data}
              />
            )}
          </table>
        </ColumnOrderingProvider>
        {selectedRows.length ? (
          <ExperimentSelectionToolbar
            datasetId={data.id}
            selectedExperiments={selectedExperiments}
            onClearSelection={clearSelection}
            onExperimentsDeleted={() => {
              refetch({}, { fetchPolicy: "network-only" });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ExperimentJobStatusIcon({
  status,
  experimentId,
  datasetId,
}: {
  status: string | null | undefined;
  experimentId: string;
  datasetId: string;
}) {
  if (status === "RUNNING") {
    return (
      <TooltipTrigger>
        <TriggerWrap>
          <ProgressCircle isIndeterminate size="S" aria-label="running" />
        </TriggerWrap>
        <RichTooltip>
          <RichTooltipTitle>Experiment In Progress</RichTooltipTitle>
          <RichTooltipDescription>
            This experiment is currently running. The results may be incomplete
          </RichTooltipDescription>
        </RichTooltip>
      </TooltipTrigger>
    );
  }
  if (status === "ERROR") {
    return (
      <TooltipTrigger>
        <TriggerWrap>
          <Icon svg={<Icons.CloseCircle />} color="danger" aria-label="error" />
        </TriggerWrap>
        <RichTooltip>
          <RichTooltipTitle>Experiment Error</RichTooltipTitle>
          <RichTooltipDescription>
            This experiment encountered an error during execution.
          </RichTooltipDescription>
          <RichTooltipActions>
            <Link to={`/datasets/${datasetId}/experiments/${experimentId}`}>
              View details
            </Link>
          </RichTooltipActions>
        </RichTooltip>
      </TooltipTrigger>
    );
  }
  return null;
}

function MissingAnnotationPieChart({
  unannotatedRatio,
}: {
  unannotatedRatio: number;
}) {
  const size = 16;

  const chartData = useMemo(
    () => [
      { name: "hasAnnotation", value: 1 - unannotatedRatio },
      { name: "missingAnnotation", value: unannotatedRatio },
    ],
    [unannotatedRatio]
  );

  return (
    <PieChart width={size} height={size}>
      <Pie
        data={chartData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={6}
        outerRadius={8}
        strokeWidth={0}
        stroke="transparent"
        startAngle={90}
        endAngle={-270}
        isAnimationActive={false}
      >
        {chartData.map((entry) => (
          <Cell
            key={entry.name}
            fill={
              entry.name === "missingAnnotation"
                ? "var(--global-color-warning)"
                : "var(--global-color-gray-300)"
            }
            opacity={entry.name === "missingAnnotation" ? 0.8 : 0.5}
          />
        ))}
      </Pie>
    </PieChart>
  );
}

function AnnotationAggregationCell({
  annotationName,
  value,
  min,
  max,
  annotatedCount,
  totalRunCount,
  baselineMeanScore,
  config,
  hasDeltaSlot = false,
}: {
  annotationName: string;
  value: number;
  min?: number | null;
  max?: number | null;
  annotatedCount: number;
  totalRunCount: number;
  /**
   * The baseline experiment's mean score; `null` when the baseline has none
   * and `undefined` when no delta is shown.
   */
  baselineMeanScore?: number | null;
  /** The annotation's evaluator config, for the delta's optimization direction */
  config?: AnnotationConfig;
  /** Keeps the delta slot open on rows without a delta, such as the baseline */
  hasDeltaSlot?: boolean;
}) {
  const color = useWordColor(annotationName);
  const percentile = useMemo(
    () => calculateAnnotationScorePercentile(value, min, max),
    [value, min, max]
  );
  const unannotatedRatio =
    totalRunCount > 0 ? 1 - annotatedCount / totalRunCount : 0;
  return (
    <ExperimentMetricCell
      leading={
        unannotatedRatio > 0.0 ? (
          <TooltipTrigger>
            <TriggerWrap>
              <MissingAnnotationPieChart unannotatedRatio={unannotatedRatio} />
            </TriggerWrap>
            <RichTooltip>
              <View width="size-2000">
                <Text size="XS">
                  {formatPercent(unannotatedRatio * 100)} (
                  {totalRunCount - annotatedCount}/{totalRunCount}) missing{" "}
                  {annotationName}
                </Text>
              </View>
            </RichTooltip>
          </TooltipTrigger>
        ) : undefined
      }
      value={
        <TooltipTrigger>
          <TriggerWrap>
            <span className="font-mono">{floatFormatter(value)}</span>
          </TriggerWrap>
          <RichTooltip>
            <View width="size-2400">
              <Heading level={3} weight="heavy">
                {annotationName}
              </Heading>
              <Flex direction="column">
                <Flex justifyContent="space-between">
                  <Text weight="heavy" size="XS">
                    Mean Score
                  </Text>
                  <Text size="XS">{floatFormatter(value)}</Text>
                </Flex>
                <Flex justifyContent="space-between">
                  <Text weight="heavy" size="XS">
                    All Experiments Min
                  </Text>
                  <Text size="XS">{floatFormatter(min)}</Text>
                </Flex>
                <Flex justifyContent="space-between">
                  <Text weight="heavy" size="XS">
                    All Experiments Max
                  </Text>
                  <Text size="XS">{floatFormatter(max)}</Text>
                </Flex>
                <Flex justifyContent="space-between">
                  <Text weight="heavy" size="XS">
                    Mean Score Percentile
                  </Text>
                  <Text size="XS">{formatPercent(percentile)}</Text>
                </Flex>
              </Flex>
            </View>
          </RichTooltip>
        </TooltipTrigger>
      }
      bar={
        <ProgressBar
          css={css`
            --mod-barloader-fill-color: ${color};
          `}
          width={ANNOTATION_BAR_WIDTH}
          value={percentile}
          aria-label="where the mean score lands between overall min max"
        />
      }
      delta={
        baselineMeanScore !== undefined ? (
          <ExperimentAnnotationMeanDelta
            annotationName={annotationName}
            meanScore={value}
            baseMeanScore={baselineMeanScore}
            config={config}
            tooltipPlacement="top"
            variant="tabular"
          />
        ) : undefined
      }
      hasDeltaSlot={hasDeltaSlot}
    />
  );
}
