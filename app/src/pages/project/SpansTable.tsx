import { css } from "@emotion/react";
import type { ColumnDef, SortingState, Table } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import { useNavigate, useParams, useSearchParams } from "react-router";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { useAdvertiseAgentContext } from "@phoenix/agent/context/useAdvertiseAgentContext";
import {
  Flex,
  Heading,
  Icon,
  Icons,
  Link,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import { TraceAnnotationSummaryGroupTokens } from "@phoenix/components/annotation/TraceAnnotationSummaryGroup";
import { ContextualHelp } from "@phoenix/components/core/tooltip/ContextualHelp";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { useTimeRange } from "@phoenix/components/datetime";
import {
  ColumnHeaderCell,
  ColumnOrderingProvider,
  CopyableTextCell,
  createRowSelectionColumn,
  LoadMoreRow,
  useColumnOrder,
} from "@phoenix/components/table";
import {
  CHECKBOX_COLUMN_ID,
  CHECKBOX_COLUMN_PINNING,
} from "@phoenix/components/table/constants";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useShiftClickRowSelection } from "@phoenix/components/table/useShiftClickRowSelection";
import { TraceTokenCosts } from "@phoenix/components/trace";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanCumulativeTokenCount } from "@phoenix/components/trace/SpanCumulativeTokenCount";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { SpanTokenCosts } from "@phoenix/components/trace/SpanTokenCosts";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { SummaryValueLabels } from "@phoenix/pages/project/AnnotationSummary";
import { MetadataTableCell } from "@phoenix/pages/project/MetadataTableCell";
import { useTracePagination } from "@phoenix/pages/trace/TracePaginationContext";
import { getTraceDetailsPath } from "@phoenix/utils/urlUtils";

import type {
  SpansTable_spans$key,
  SpanStatusCode,
} from "./__generated__/SpansTable_spans.graphql";
import type { SpansTableSpansQuery } from "./__generated__/SpansTableSpansQuery.graphql";
import { DEFAULT_PAGE_SIZE } from "./constants";
import {
  SpanInputValueTooltipCell,
  SpanOutputValueTooltipCell,
} from "./IOValueTooltipCell";
import { ProjectFilterConfigButton } from "./ProjectFilterConfigButton";
import { ProjectTableEmpty } from "./ProjectTableEmpty";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";
import { getVisibleSpanAnnotationColumnNames } from "./spanAnnotationUtils";
import { SpanColumnSelector } from "./SpanColumnSelector";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { useSpanFilters } from "./SpanFiltersContext";
import { SpanNotesTableCell } from "./SpanNotesTableCell";
import { SpanSelectionToolbar } from "./SpanSelectionToolbar";
import { SpansTableAside } from "./SpansTableAside";
import { spansTableCSS } from "./styles";
import { TableAsidePanel, TableAsideToggleButton } from "./TableAside";
import { TableMetricsChartsPanelGroup } from "./TableMetricsCharts";
import { TableMetricsChartSelector } from "./TableMetricsChartSelector";
import {
  DEFAULT_SORT,
  getGqlSort,
  makeAnnotationColumnId,
  TRACE_ANNOTATIONS_COLUMN_ID,
} from "./tableUtils";
import { TraceNotesTableCell } from "./TraceNotesTableCell";

type SpansTableProps = {
  project: SpansTable_spans$key;
};

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

type RootSpanFilterValue = "root" | "all";

const defaultColumnSettings = {
  minSize: 100,
} satisfies Partial<ColumnDef<unknown>>;

function isRootSpanFilterValue(val: unknown): val is RootSpanFilterValue {
  return val === "root" || val === "all";
}

const TableBody = <T extends { trace: { traceId: string }; id: string }>({
  table,
  hasNext,
  onLoadNext,
  isLoadingNext,
}: {
  table: Table<T>;
  hasNext: boolean;
  onLoadNext: () => void;
  isLoadingNext: boolean;
}) => {
  "use no memo";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { traceId } = useParams();
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => {
        const isSelected =
          selectedSpanNodeId === row.original.id ||
          (!selectedSpanNodeId && row.original.trace.traceId === traceId);
        return (
          <tr
            key={row.id}
            data-selected={isSelected}
            onClick={() =>
              navigate(
                getTraceDetailsPath({
                  traceId: row.original.trace.traceId,
                  spanNodeId: row.original.id,
                  searchParams,
                })
              )
            }
          >
            {row.getVisibleCells().map((cell) => {
              const colSizeVar = `--col-${cell.column.id}-size`;
              return (
                <td
                  key={cell.id}
                  style={{
                    ...getCommonPinningStyles(cell.column),
                    width: `calc(var(${colSizeVar}) * 1px)`,
                    maxWidth: `calc(var(${colSizeVar}) * 1px)`,
                    // prevent all wrapping, just show an ellipsis and let users expand if necessary
                    textWrap: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
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

// special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = React.memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

export function SpansTable(props: SpansTableProps) {
  const [searchParams] = useSearchParams();
  const { fetchKey } = useStreamState();
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef<boolean>(true);
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const { rootSpansOnly, setRootSpansOnly } = useSpanFilters();
  const projectId = useTracingContext((state) => state.projectId);
  // Source the time range directly here (rather than only via the preloaded
  // parent query) so a live window sliding forward refetches with the filter
  // still applied. The parent query is intentionally not reloaded on window
  // slides — see the load effect in `ProjectPage` and issue #14216.
  const { timeRangeISOStrings } = useTimeRange();

  // Advertise the current rootSpansOnly state so the agent's context message
  // reflects whether the toggle is mounted on this tab.
  const advertisedRootSpansOnlyContext = useMemo<AgentContext | null>(() => {
    if (!projectId) {
      return null;
    }
    return {
      type: "project",
      projectNodeId: projectId,
      rootSpansOnly,
    };
  }, [projectId, rootSpansOnly]);
  useAdvertiseAgentContext(advertisedRootSpansOnlyContext);

  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<SpansTableSpansQuery, SpansTable_spans$key>(
      graphql`
        fragment SpansTable_spans on Project
        @refetchable(queryName: "SpansTableSpansQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 30 }
          rootSpansOnly: { type: "Boolean", defaultValue: true }
          sort: {
            type: "SpanSort"
            defaultValue: { col: startTime, dir: desc }
          }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          name
          spanAnnotationNames
          ...SpanColumnSelector_annotations
          ...SpanColumnSelector_traceAnnotations
          spans(
            first: $first
            after: $after
            sort: $sort
            rootSpansOnly: $rootSpansOnly
            filterCondition: $filterCondition
            orphanSpanAsRootSpan: $orphanSpanAsRootSpan
            timeRange: $timeRange
          ) @connection(key: "SpansTable_spans") {
            edges {
              span: node {
                id
                spanKind
                name
                metadata
                userId
                statusCode
                statusMessage
                startTime
                latencyMs
                tokenCountTotal @skip(if: $rootSpansOnly)
                cumulativeTokenCountTotal @include(if: $rootSpansOnly)
                spanId
                trace {
                  id
                  traceId
                  costSummary @include(if: $rootSpansOnly) {
                    total {
                      cost
                    }
                  }
                  traceAnnotationSummaries {
                    labelFractions {
                      fraction
                      label
                    }
                    count
                    meanScore
                    name
                  }
                  ...TraceAnnotationSummaryGroup
                }
                input {
                  value: truncatedValue
                }
                output {
                  value: truncatedValue
                }
                spanAnnotations {
                  id
                  name
                  label
                  score
                  annotatorKind
                  createdAt
                }
                spanAnnotationSummaries {
                  labelFractions {
                    fraction
                    label
                  }
                  meanScore
                  name
                }
                documentRetrievalMetrics {
                  evaluationName
                  ndcg
                  precision
                  hit
                }
                costSummary @skip(if: $rootSpansOnly) {
                  total {
                    cost
                  }
                }
                ...AnnotationSummaryGroup
              }
            }
          }
        }
      `,
      props.project
    );

  const pagination = useTracePagination();
  const setTraceSequence = pagination?.setTraceSequence;
  useEffect(() => {
    if (!setTraceSequence) {
      return;
    }
    setTraceSequence(
      data.spans.edges.map(({ span }) => ({
        traceId: span.trace.traceId,
        spanId: span.id,
      }))
    );
    return () => {
      setTraceSequence([]);
    };
  }, [data.spans.edges, setTraceSequence]);

  const annotationColumnVisibility = useTracingContext(
    (state) => state.annotationColumnVisibility
  );
  const visibleAnnotationColumnNames = useMemo(() => {
    return getVisibleSpanAnnotationColumnNames({
      spanAnnotationNames: data.spanAnnotationNames,
      annotationVisibility: annotationColumnVisibility,
    });
  }, [data.spanAnnotationNames, annotationColumnVisibility]);
  const traceAnnotationColumnVisibility = useTracingContext(
    (state) => state.traceAnnotationColumnVisibility
  );
  const visibleTraceAnnotationColumnNames = useMemo(() => {
    return Object.keys(traceAnnotationColumnVisibility).filter(
      (name) => traceAnnotationColumnVisibility[name]
    );
  }, [traceAnnotationColumnVisibility]);

  const tableData = useMemo(() => {
    const tableData = data.spans.edges.map(({ span }) => span);

    return tableData;
  }, [data]);
  type TableRow = (typeof tableData)[number];
  const { selectRow } = useShiftClickRowSelection<TableRow>({
    resetKey: tableData,
  });

  const dynamicAnnotationColumns: ColumnDef<TableRow>[] =
    visibleAnnotationColumnNames.map((name) => {
      return {
        header: name,
        columns: [
          {
            header: `labels`,
            accessorKey: makeAnnotationColumnId(name, "label"),
            cell: ({ row }) => {
              const annotation = row.original.spanAnnotationSummaries.find(
                (annotation) => annotation.name === name
              );
              if (!annotation) {
                return null;
              }
              return (
                <SummaryValueLabels
                  name={name}
                  labelFractions={annotation.labelFractions}
                />
              );
            },
          } as ColumnDef<TableRow>,
          {
            header: `mean score`,
            accessorKey: makeAnnotationColumnId(name, "score"),
            cell: ({ row }) => {
              const annotation = row.original.spanAnnotationSummaries.find(
                (annotation) => annotation.name === name
              );
              if (!annotation) {
                return null;
              }
              return <MeanScore value={annotation.meanScore} fallback={null} />;
            },
          } as ColumnDef<TableRow>,
        ],
      };
    });

  const dynamicTraceAnnotationColumns: ColumnDef<TableRow>[] =
    visibleTraceAnnotationColumnNames.map((name) => {
      return {
        header: name,
        columns: [
          {
            header: `labels`,
            accessorKey: makeAnnotationColumnId(name, "label", "trace"),
            enableSorting: false,
            cell: ({ row }) => {
              const annotation =
                row.original.trace.traceAnnotationSummaries.find(
                  (annotation) => annotation.name === name
                );
              if (!annotation) {
                return null;
              }
              return (
                <SummaryValueLabels
                  name={name}
                  labelFractions={annotation.labelFractions}
                />
              );
            },
          } as ColumnDef<TableRow>,
          {
            header: `mean score`,
            accessorKey: makeAnnotationColumnId(name, "score", "trace"),
            enableSorting: false,
            cell: ({ row }) => {
              const annotation =
                row.original.trace.traceAnnotationSummaries.find(
                  (annotation) => annotation.name === name
                );
              if (!annotation) {
                return null;
              }
              return <MeanScore value={annotation.meanScore} fallback={null} />;
            },
          } as ColumnDef<TableRow>,
        ],
      };
    });

  const annotationColumns: ColumnDef<TableRow>[] = [
    {
      header: () => (
        <Flex direction="row" gap="size-50">
          <span>annotations</span>
          <ContextualHelp>
            <Heading level={3} weight="heavy">
              Annotations
            </Heading>
            <Text>
              Evaluations and human annotations logged via the API or set via
              the UI.
            </Text>
          </ContextualHelp>
        </Flex>
      ),
      id: "annotations",
      accessorKey: "spanAnnotations",
      enableSorting: false,

      cell: ({ row }) => {
        return (
          <Flex direction="row" gap="size-50" wrap="wrap">
            <AnnotationSummaryGroupTokens
              span={row.original}
              showFilterActions
            />
            {row.original.documentRetrievalMetrics.map((retrievalMetric) => {
              return (
                <>
                  <RetrievalEvaluationLabel
                    key="ndcg"
                    name={retrievalMetric.evaluationName}
                    metric="ndcg"
                    score={retrievalMetric.ndcg}
                  />
                  <RetrievalEvaluationLabel
                    key="precision"
                    name={retrievalMetric.evaluationName}
                    metric="precision"
                    score={retrievalMetric.precision}
                  />
                  <RetrievalEvaluationLabel
                    key="hit"
                    name={retrievalMetric.evaluationName}
                    metric="hit"
                    score={retrievalMetric.hit}
                  />
                </>
              );
            })}
          </Flex>
        );
      },
    },
    {
      header: () => (
        <Flex direction="row" gap="size-50">
          <span>trace annotations</span>
          <ContextualHelp>
            <Heading level={3} weight="heavy">
              Trace annotations
            </Heading>
            <Text>Annotations attached to the parent trace of this span.</Text>
          </ContextualHelp>
        </Flex>
      ),
      id: TRACE_ANNOTATIONS_COLUMN_ID,
      enableSorting: false,
      cell: ({ row }) => {
        return (
          <Flex direction="row" gap="size-50" wrap="wrap">
            <TraceAnnotationSummaryGroupTokens trace={row.original.trace} />
          </Flex>
        );
      },
    },
    ...dynamicAnnotationColumns,
    ...dynamicTraceAnnotationColumns,
  ];
  const columns: ColumnDef<TableRow>[] = [
    createRowSelectionColumn<TableRow>({
      selectRow,
      size: 24,
      minSize: 24,
      maxSize: 24,
    }),
    {
      header: "status",
      accessorKey: "statusCode",
      enableSorting: false,
      minSize: 50,
      maxSize: 50,
      cell: ({ getValue }) => {
        const statusCode = getValue() as SpanStatusCode;
        return <SpanStatusCodeIcon statusCode={statusCode} />;
      },
    },
    {
      header: "kind",
      accessorKey: "spanKind",
      maxSize: 100,
      enableSorting: false,
      cell: ({ getValue }) => {
        return <SpanKindToken spanKind={getValue() as string} />;
      },
    },
    {
      header: "name",
      accessorKey: "name",
      enableSorting: false,
      cell: ({ getValue, row }) => {
        const span = row.original;
        const { traceId } = span.trace;
        return (
          <Link
            to={getTraceDetailsPath({
              traceId,
              spanNodeId: span.id,
              searchParams,
            })}
          >
            {getValue() as string}
          </Link>
        );
      },
    },
    {
      header: "span id",
      accessorKey: "spanId",
      enableSorting: false,
      cell: ({ getValue }) => (
        <CopyableTextCell value={getValue() as string | null} />
      ),
    },
    {
      header: "trace id",
      accessorKey: "trace.traceId",
      id: "traceId",
      enableSorting: false,
      cell: ({ getValue }) => (
        <CopyableTextCell value={getValue() as string | null} />
      ),
    },
    {
      header: "input",
      accessorKey: "input.value",
      cell: ({ getValue, row }) => (
        <SpanInputValueTooltipCell
          nodeId={row.original.id}
          preview={getValue()}
        />
      ),
      enableSorting: false,
    },
    {
      header: "output",
      accessorKey: "output.value",
      cell: ({ getValue, row }) => (
        <SpanOutputValueTooltipCell
          nodeId={row.original.id}
          preview={getValue()}
        />
      ),
      enableSorting: false,
    },
    {
      header: () => (
        <Flex direction="row" gap="size-50">
          <span>error</span>
          <ContextualHelp>
            <Heading level={3} weight="heavy">
              Error
            </Heading>
            <Text>
              The status message recorded on the span when its status code is
              ERROR, e.g. an exception message.
            </Text>
          </ContextualHelp>
        </Flex>
      ),
      accessorKey: "statusMessage",
      id: "error",
      enableSorting: false,
      cell: ({ getValue }) => {
        const value = getValue() as string;
        if (!value) {
          return "--";
        }
        return <Text color="danger">{value}</Text>;
      },
    },
    {
      header: "notes",
      accessorKey: "spanAnnotations",
      id: "spanNotes",
      minSize: 50,
      maxSize: 75,
      enableSorting: false,
      cell: ({ row }) => {
        const noteCount = row.original.spanAnnotations.filter(
          (annotation) => annotation.name === "note"
        ).length;
        return (
          <SpanNotesTableCell noteCount={noteCount} spanId={row.original.id} />
        );
      },
    },
    {
      header: "trace notes",
      id: "traceNotes",
      minSize: 50,
      maxSize: 90,
      enableSorting: false,
      cell: ({ row }) => {
        const noteCount =
          row.original.trace.traceAnnotationSummaries.find(
            (annotation) => annotation.name === "note"
          )?.count ?? 0;
        return (
          <TraceNotesTableCell
            noteCount={noteCount}
            traceId={row.original.trace.id}
          />
        );
      },
    },
    {
      header: "metadata",
      accessorKey: "metadata",
      cell: ({ row }) => <MetadataTableCell metadata={row.original.metadata} />,
      enableSorting: false,
    },
    {
      header: "user",
      accessorKey: "userId",
      enableSorting: false,
      cell: ({ getValue }) => (
        <CopyableTextCell value={getValue() as string | null} />
      ),
    },
    ...annotationColumns, // TODO: consider hiding this column if there are no evals. For now we want people to know that there are evals
    {
      header: "start time",
      accessorKey: "startTime",
      cell: TimestampCell,
    },
    {
      header: "latency",
      accessorKey: "latencyMs",

      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || typeof value !== "number") {
          return null;
        }
        return <LatencyText latencyMs={value} />;
      },
    },
    {
      header: rootSpansOnly ? "cumulative tokens" : "total tokens",
      accessorKey: rootSpansOnly
        ? "cumulativeTokenCountTotal"
        : "tokenCountTotal",
      cell: ({ row, getValue }) => {
        const value = getValue();
        if (value === null) {
          return "--";
        }
        const span = row.original;
        const tokenCountTotal = rootSpansOnly
          ? span.cumulativeTokenCountTotal
          : span.tokenCountTotal;

        if (rootSpansOnly) {
          return (
            <SpanCumulativeTokenCount
              tokenCountTotal={tokenCountTotal || 0}
              nodeId={span.id}
            />
          );
        }

        return (
          <SpanTokenCount
            tokenCountTotal={tokenCountTotal || 0}
            nodeId={span.id}
          />
        );
      },
    },
    {
      header: rootSpansOnly ? "cumulative cost" : "total cost",
      accessorKey: rootSpansOnly
        ? "trace.costSummary.total.cost"
        : "costSummary.total.cost",
      id: rootSpansOnly ? "cumulativeTokenCostTotal" : "tokenCostTotal",
      cell: ({ row, getValue }) => {
        const value = getValue();
        if (value === null || typeof value !== "number") {
          return "--";
        }
        const span = row.original;
        return rootSpansOnly ? (
          <TraceTokenCosts totalCost={value} nodeId={span.trace.id} size="S" />
        ) : (
          <SpanTokenCosts totalCost={value} spanNodeId={span.id} size="S" />
        );
      },
    },
  ];

  useEffect(() => {
    // Skip the first render. It's been loaded by the parent
    if (isFirstRender.current === true) {
      isFirstRender.current = false;
      return;
    }
    //if the sorting changes, we need to reset the pagination
    startTransition(() => {
      const sort = sorting[0];
      refetch(
        {
          sort: sort ? getGqlSort(sort) : DEFAULT_SORT,
          after: null,
          first: PAGE_SIZE,
          filterCondition,
          rootSpansOnly,
          timeRange: timeRangeISOStrings,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [
    sorting,
    refetch,
    filterCondition,
    fetchKey,
    rootSpansOnly,
    timeRangeISOStrings,
  ]);
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
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
  const setColumnSizing = useTracingContext((state) => state.setColumnSizing);
  const columnSizing = useTracingContext((state) => state.columnSizing);
  const storedColumnOrder = useTracingContext((state) => state.columnOrder);
  const setStoredColumnOrder = useTracingContext(
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
    onColumnOrderChange: setStoredColumnOrder,
    columnVisibility,
    nonOrderableColumnIds: [CHECKBOX_COLUMN_ID],
  });
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnSizing,
      columnOrder: leafColumnOrder,
      columnPinning: CHECKBOX_COLUMN_PINNING,
    },
    defaultColumn: defaultColumnSettings,
    columnResizeMode: "onChange",
    manualSorting: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedSpans = selectedRows.map((row) => ({
    id: row.original.id,
    spanId: row.original.spanId,
    trace: {
      id: row.original.trace.id,
      traceId: row.original.trace.traceId,
    },
  }));
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);
  const isEmpty = rows.length === 0;
  const computedColumns = table.getAllColumns().filter((column) => {
    // Filter out columns that are eval groupings
    return column.columns.length === 0;
  });

  const { columnSizingInfo, columnSizing: columnSizingState } =
    table.getState();
  const getFlatHeaders = table.getFlatHeaders;
  const colLength = computedColumns.length;
  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
   */
  const [columnSizeVars] = useMemo(() => {
    const headers = getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return [colSizes];
    // Disabled lint as per tanstack docs linked above

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizingState, colLength]);

  return (
    <TableMetricsChartsPanelGroup view="spans">
      <div css={spansTableCSS}>
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
            <SpanFilterConditionField onValidCondition={setFilterCondition} />

            <ToggleButtonGroup
              aria-label="Toggle between root and all spans"
              selectionMode="single"
              selectedKeys={[rootSpansOnly ? "root" : "all"]}
              onSelectionChange={(selection) => {
                if (selection.size === 0) {
                  return;
                }
                const selectedKey = selection.keys().next().value;
                if (isRootSpanFilterValue(selectedKey)) {
                  setRootSpansOnly(selectedKey === "root");
                } else {
                  throw new Error(
                    `Unknown root span filter selection: ${selectedKey}`
                  );
                }
              }}
            >
              <ToggleButton aria-label="root spans" id="root">
                Root Spans
              </ToggleButton>
              <ToggleButton aria-label="all spans" id="all">
                All
              </ToggleButton>
            </ToggleButtonGroup>
            <TableMetricsChartSelector view="spans" />
            <SpanColumnSelector columns={table.getAllColumns()} query={data} />
            <ProjectFilterConfigButton />
            <TableAsideToggleButton />
          </Flex>
        </View>
        <Group
          orientation="horizontal"
          id="spans-table-layout"
          css={css`
            flex: 1 1 auto;
            min-height: 0;
          `}
        >
          <Panel>
            <div
              css={css`
                height: 100%;
                overflow: auto;
              `}
              onScroll={(e) =>
                fetchMoreOnBottomReached(e.target as HTMLDivElement)
              }
              ref={tableContainerRef}
            >
              <ColumnOrderingProvider
                columnOrder={visibleColumnOrder}
                onColumnOrderChange={onVisibleColumnOrderChange}
              >
                <table
                  css={selectableTableCSS}
                  style={{
                    ...columnSizeVars,
                    width: table.getTotalSize(),
                    minWidth: "100%",
                  }}
                >
                  <thead>
                    {table
                      .getHeaderGroups()
                      .map((headerGroup, headerGroupIndex) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => {
                            const headerStyle = {
                              ...getCommonPinningStyles(header.column),
                              width: `calc(var(--header-${header.id}-size) * 1px)`,
                            };
                            const headerContent =
                              header.isPlaceholder ? null : (
                                <>
                                  <div
                                    {...{
                                      className: header.column.getCanSort()
                                        ? "sort"
                                        : "",
                                      onClick:
                                        header.column.getToggleSortingHandler(),
                                      style: {
                                        left: header.getStart(),
                                        width: header.getSize(),
                                      },
                                    }}
                                  >
                                    <Truncate maxWidth={header.getSize()}>
                                      {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                      )}
                                    </Truncate>
                                    {header.column.getIsSorted() ? (
                                      <Icon
                                        className="sort-icon"
                                        svg={
                                          header.column.getIsSorted() ===
                                          "asc" ? (
                                            <Icons.CaretUpFilled />
                                          ) : (
                                            <Icons.CaretDownFilled />
                                          )
                                        }
                                      />
                                    ) : null}
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
                              );
                            return (
                              <ColumnHeaderCell
                                key={header.id}
                                columnId={header.column.id}
                                // Only the top header group is reorderable;
                                // sub-headers of a group column move with it
                                index={
                                  headerGroupIndex === 0
                                    ? getColumnOrderIndex(header.column.id)
                                    : -1
                                }
                                label={
                                  typeof header.column.columnDef.header ===
                                  "string"
                                    ? header.column.columnDef.header
                                    : undefined
                                }
                                colSpan={header.colSpan}
                                style={headerStyle}
                              >
                                {headerContent}
                              </ColumnHeaderCell>
                            );
                          })}
                        </tr>
                      ))}
                  </thead>
                  {isEmpty && !hasNext ? (
                    // The trace-based pagination optimization (https://github.com/Arize-ai/phoenix/pull/8539)
                    // can result in isEmpty=true and hasNext=true when traces exist but lack matching root
                    // spans. This is an undesirable edge case. The optimization is a stopgap solution that
                    // will be replaced to eliminate this condition.
                    <ProjectTableEmpty />
                  ) : columnSizingInfo.isResizingColumn ? (
                    <MemoizedTableBody
                      table={table}
                      hasNext={hasNext}
                      onLoadNext={() => loadNext(PAGE_SIZE)}
                      isLoadingNext={isLoadingNext}
                    />
                  ) : (
                    <TableBody
                      table={table}
                      hasNext={hasNext}
                      onLoadNext={() => loadNext(PAGE_SIZE)}
                      isLoadingNext={isLoadingNext}
                    />
                  )}
                </table>
              </ColumnOrderingProvider>
            </div>
          </Panel>
          <TableAsidePanel>
            <SpansTableAside filterCondition={filterCondition} />
          </TableAsidePanel>
        </Group>
        {selectedRows.length ? (
          <SpanSelectionToolbar
            selectedSpans={selectedSpans}
            onClearSelection={clearSelection}
          />
        ) : null}
      </div>
    </TableMetricsChartsPanelGroup>
  );
}
