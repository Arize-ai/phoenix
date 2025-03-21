import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useMatch, useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Content, ContextualHelp } from "@arizeai/components";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  Link,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";
import {
  AnnotationLabel,
  AnnotationTooltip,
} from "@phoenix/components/annotation";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { MetadataTableCell } from "@phoenix/pages/project/MetadataTableCell";

import {
  SpansTable_spans$key,
  SpanStatusCode,
} from "./__generated__/SpansTable_spans.graphql";
import { SpansTableSpansQuery } from "./__generated__/SpansTableSpansQuery.graphql";
import { AnnotationTooltipFilterActions } from "./AnnotationTooltipFilterActions";
import { DEFAULT_PAGE_SIZE } from "./constants";
import { ProjectTableEmpty } from "./ProjectTableEmpty";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";
import { SpanColumnSelector } from "./SpanColumnSelector";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { SpanSelectionToolbar } from "./SpanSelectionToolbar";
import { spansTableCSS } from "./styles";
import {
  ANNOTATIONS_COLUMN_PREFIX,
  ANNOTATIONS_KEY_SEPARATOR,
  DEFAULT_SORT,
  getGqlSort,
} from "./tableUtils";

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
}: {
  table: Table<T>;
}) => {
  const navigate = useNavigate();
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => {
        return (
          <tr
            key={row.id}
            onClick={() =>
              navigate(
                `${row.original.trace.traceId}?selectedSpanNodeId=${row.original.id}`
              )
            }
          >
            {row.getVisibleCells().map((cell) => {
              return (
                <td
                  key={cell.id}
                  style={{
                    // the cell still grows to fit, we just need some height declared
                    // so that height: 100% works in children elements
                    height: 1,
                    width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                    maxWidth: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                    // prevent all wrapping, just show an ellipsis and let users expand if necessary
                    textWrap: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
};

// special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = React.memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

export function SpansTable(props: SpansTableProps) {
  const { fetchKey } = useStreamState();
  // Determine if the table is active based on the current path
  const isTableActive = !!useMatch("/projects/:projectId/spans");
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef<boolean>(true);
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const [rootSpansOnly, setRootSpansOnly] = useState<boolean>(true);
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
          ...SpanColumnSelector_annotations
          spans(
            first: $first
            after: $after
            sort: $sort
            rootSpansOnly: $rootSpansOnly
            filterCondition: $filterCondition
            timeRange: $timeRange
          ) @connection(key: "SpansTable_spans") {
            edges {
              span: node {
                id
                spanKind
                name
                metadata
                statusCode
                startTime
                latencyMs
                tokenCountTotal
                tokenCountPrompt
                tokenCountCompletion
                cumulativeTokenCountTotal
                cumulativeTokenCountPrompt
                cumulativeTokenCountCompletion
                spanId
                trace {
                  id
                  traceId
                }
                input {
                  value: truncatedValue
                }
                output {
                  value: truncatedValue
                }
                spanAnnotations {
                  name
                  label
                  score
                  annotatorKind
                }
                documentRetrievalMetrics {
                  evaluationName
                  ndcg
                  precision
                  hit
                }
              }
            }
          }
        }
      `,
      props.project
    );

  const annotationColumnVisibility = useTracingContext(
    (state) => state.annotationColumnVisibility
  );
  const visibleAnnotationColumnNames = useMemo(() => {
    return Object.keys(annotationColumnVisibility).filter(
      (name) => annotationColumnVisibility[name]
    );
  }, [annotationColumnVisibility]);

  const tableData = useMemo(() => {
    const tableData = data.spans.edges.map(({ span }) => span);

    return tableData;
  }, [data]);
  type TableRow = (typeof tableData)[number];

  const dynamicAnnotationColumns: ColumnDef<TableRow>[] =
    visibleAnnotationColumnNames.map((name) => {
      return {
        header: name,
        columns: [
          {
            header: `label`,
            accessorKey: `${ANNOTATIONS_COLUMN_PREFIX}${ANNOTATIONS_KEY_SEPARATOR}label${ANNOTATIONS_KEY_SEPARATOR}${name}`,
            cell: ({ row }) => {
              const annotation = row.original.spanAnnotations.find(
                (annotation) => annotation.name === name
              );
              if (!annotation) {
                return null;
              }
              return annotation.label;
            },
          } as ColumnDef<TableRow>,
          {
            header: `score`,
            accessorKey: `${ANNOTATIONS_COLUMN_PREFIX}${ANNOTATIONS_KEY_SEPARATOR}score${ANNOTATIONS_KEY_SEPARATOR}${name}`,
            cell: ({ row }) => {
              const annotation = row.original.spanAnnotations.find(
                (annotation) => annotation.name === name
              );
              if (!annotation) {
                return null;
              }
              return annotation.score;
            },
          } as ColumnDef<TableRow>,
        ],
      };
    });

  const annotationColumns: ColumnDef<TableRow>[] = [
    {
      header: () => (
        <Flex direction="row" gap="size-50">
          <span>feedback</span>
          <ContextualHelp>
            <Heading level={3} weight="heavy">
              Feedback
            </Heading>
            <Content>
              Feedback includes evaluations and human annotations logged via the
              API or set via the UI.
            </Content>
          </ContextualHelp>
        </Flex>
      ),
      id: "feedback",
      accessorKey: "spanAnnotations",
      enableSorting: false,

      cell: ({ row }) => {
        return (
          <Flex direction="row" gap="size-50" wrap="wrap">
            {row.original.spanAnnotations.map((annotation) => {
              return (
                <AnnotationTooltip
                  key={annotation.name}
                  annotation={annotation}
                  layout="horizontal"
                  width="500px"
                  extra={
                    <AnnotationTooltipFilterActions annotation={annotation} />
                  }
                >
                  <AnnotationLabel
                    annotation={annotation}
                    annotationDisplayPreference="label"
                  />
                </AnnotationTooltip>
              );
            })}
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
    ...dynamicAnnotationColumns,
  ];
  const columns: ColumnDef<TableRow>[] = [
    {
      id: "select",
      maxSize: 10,
      header: ({ table }) => (
        <IndeterminateCheckboxCell
          {...{
            checked: table.getIsAllRowsSelected(),
            indeterminate: table.getIsSomeRowsSelected(),
            onChange: table.getToggleAllRowsSelectedHandler(),
          }}
        />
      ),
      cell: ({ row }) => (
        <IndeterminateCheckboxCell
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler(),
          }}
        />
      ),
    },
    {
      header: "status",
      accessorKey: "statusCode",
      maxSize: 30,
      enableSorting: false,
      cell: ({ getValue }) => {
        const statusCode = getValue() as SpanStatusCode;
        return (
          <Flex direction="row" gap="size-50" alignItems="center">
            <SpanStatusCodeIcon statusCode={statusCode} />
          </Flex>
        );
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
          <Link to={`${traceId}?selectedSpanNodeId=${span.id}`}>
            {getValue() as string}
          </Link>
        );
      },
    },
    {
      header: "input",
      accessorKey: "input.value",
      cell: TextCell,
      enableSorting: false,
    },
    {
      header: "output",
      accessorKey: "output.value",
      cell: TextCell,
      enableSorting: false,
    },
    {
      header: "metadata",
      accessorKey: "metadata",
      cell: ({ row }) => <MetadataTableCell metadata={row.original.metadata} />,
      enableSorting: false,
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
        const tokenCountPrompt = rootSpansOnly
          ? span.cumulativeTokenCountPrompt
          : span.tokenCountPrompt;
        const tokenCountCompletion = rootSpansOnly
          ? span.cumulativeTokenCountCompletion
          : span.tokenCountCompletion;
        return (
          <TokenCount
            tokenCountTotal={tokenCountTotal || 0}
            tokenCountPrompt={tokenCountPrompt || 0}
            tokenCountCompletion={tokenCountCompletion || 0}
          />
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
    if (isTableActive) {
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
          },
          { fetchPolicy: "store-and-network" }
        );
      });
    }
  }, [
    sorting,
    refetch,
    filterCondition,
    fetchKey,
    isTableActive,
    rootSpansOnly,
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
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnSizing,
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
    traceId: row.original.trace.id,
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
  const columnSizeVars = React.useMemo(() => {
    const headers = getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // Disabled lint as per tanstack docs linked above
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFlatHeaders, columnSizingInfo, columnSizingState, colLength]);

  return (
    <div css={spansTableCSS}>
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-200"
        paddingEnd="size-200"
        borderBottomColor="grey-300"
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
          <SpanColumnSelector columns={computedColumns} query={data} />
        </Flex>
      </View>
      <div
        css={css`
          flex: 1 1 auto;
          overflow: auto;
        `}
        onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
        ref={tableContainerRef}
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
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    style={{
                      width: `calc(var(--header-${header.id}-size) * 1px)`,
                    }}
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          {...{
                            className: header.column.getCanSort()
                              ? "cursor-pointer"
                              : "",
                            onClick: header.column.getToggleSortingHandler(),
                            style: {
                              left: header.getStart(),
                              width: header.getSize(),
                            },
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getIsSorted() ? (
                            <Icon
                              className="sort-icon"
                              svg={
                                header.column.getIsSorted() === "asc" ? (
                                  <Icons.ArrowUpFilled />
                                ) : (
                                  <Icons.ArrowDownFilled />
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
                              header.column.getIsResizing() ? "isResizing" : ""
                            }`,
                          }}
                        />
                      </>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {isEmpty ? (
            <ProjectTableEmpty projectName={data.name} />
          ) : columnSizingInfo.isResizingColumn ? (
            <MemoizedTableBody table={table} />
          ) : (
            <TableBody table={table} />
          )}
        </table>
      </div>
      {selectedRows.length ? (
        <SpanSelectionToolbar
          selectedSpans={selectedSpans}
          onClearSelection={clearSelection}
        />
      ) : null}
    </div>
  );
}
