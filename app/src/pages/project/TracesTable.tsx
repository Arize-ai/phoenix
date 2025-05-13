/* eslint-disable react/prop-types */
import React, {
  ComponentProps,
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate, useParams } from "react-router";
import {
  CellContext,
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  SortingState,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Content, ContextualHelp } from "@arizeai/components";

import { Flex, Heading, Icon, Icons, Link, View } from "@phoenix/components";
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import { TextCell } from "@phoenix/components/table";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableExpandButton } from "@phoenix/components/table/TableExpandButton";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { ISpanItem } from "@phoenix/components/trace/types";
import { createSpanTree, SpanTreeNode } from "@phoenix/components/trace/utils";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";
import { SummaryValueLabels } from "@phoenix/pages/project/AnnotationSummary";
import { MetadataTableCell } from "@phoenix/pages/project/MetadataTableCell";
import { useTracePagination } from "@phoenix/pages/trace/TracePaginationContext";

import {
  SpanStatusCode,
  TracesTable_spans$data,
  TracesTable_spans$key,
} from "./__generated__/TracesTable_spans.graphql";
import { TracesTableQuery } from "./__generated__/TracesTableQuery.graphql";
import { DEFAULT_PAGE_SIZE } from "./constants";
import { ProjectTableEmpty } from "./ProjectTableEmpty";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";
import { SpanColumnSelector } from "./SpanColumnSelector";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { SpanSelectionToolbar } from "./SpanSelectionToolbar";
import { spansTableCSS } from "./styles";
import { DEFAULT_SORT, getGqlSort, makeAnnotationColumnId } from "./tableUtils";

type TracesTableProps = {
  project: TracesTable_spans$key;
};

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
// The number of descendants that's loaded from the server
// NB: this number is hard coded in the query below but should be kept in sync
const NUM_DESCENDANTS = 50;

interface IAdditionalSpansIndicator {
  /**
   * A flag that if set, indicates that this row is just there to show that there are N more spans under this span
   */
  isAdditionalSpansRow?: true;
}
/**
 * An indicator that this row is an additional row, not a span
 */
interface IAdditionalSpansRow extends ISpanItem, IAdditionalSpansIndicator {}

/**
 * A nested table row is a span with a children that recursively
 * contains more nested table rows.
 */
type NestedSpanTableRow<TSpan extends IAdditionalSpansRow> = TSpan & {
  children: NestedSpanTableRow<TSpan>[];
};

const TableBody = <
  T extends TracesTable_spans$data["rootSpans"]["edges"][number]["rootSpan"] &
    IAdditionalSpansRow,
>({
  table,
}: {
  table: Table<T>;
}) => {
  const navigate = useNavigate();
  const { traceId } = useParams();
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => {
        const isSelected = row.original.trace.traceId === traceId;
        return (
          <tr
            key={row.id}
            onClick={() => navigate(`${row.original.trace.traceId}`)}
            data-is-additional-row={row.original.__additionalRow}
            data-selected={isSelected}
            css={css(trCSS)}
          >
            {row.getVisibleCells().map((cell) => {
              const colSizeVar = `--col-${cell.column.id}-size`;
              return (
                <td
                  key={cell.id}
                  style={{
                    width: `calc(var(${colSizeVar}) * 1px)`,
                    maxWidth: `calc(var(${colSizeVar}) * 1px)`,
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

const MetadataCell = <TData extends ISpanItem, TValue>({
  row,
}: CellContext<TData, TValue>) => {
  if (row.original.__additionalRow) {
    return null;
  }
  return <MetadataTableCell metadata={row.original.metadata} />;
};

const trCSS = css`
  &[data-is-additional-row="true"] {
    box-shadow: inset 0 -10px 20px var(--ac-global-color-grey-100);
  }
`;

/**
 * Recursively create a nested table rows to display the span tree
 * as a table.
 */
function spanTreeToNestedSpanTableRows<TSpan extends ISpanItem>(params: {
  children: SpanTreeNode<TSpan>[];
}): NestedSpanTableRow<TSpan>[] {
  const { children } = params;
  const normalizedSpanTreeChildren: NestedSpanTableRow<TSpan>[] = [];
  for (const child of children) {
    const normalizedChild = {
      ...child.span,
      children: spanTreeToNestedSpanTableRows({
        children: child.children,
      }),
    };
    normalizedSpanTreeChildren.push(normalizedChild);
  }
  return normalizedSpanTreeChildren;
}

export function TracesTable(props: TracesTableProps) {
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef<boolean>(true);
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const { fetchKey } = useStreamState();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<TracesTableQuery, TracesTable_spans$key>(
      graphql`
        fragment TracesTable_spans on Project
        @refetchable(queryName: "TracesTableQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 30 }
          sort: {
            type: "SpanSort"
            defaultValue: { col: startTime, dir: desc }
          }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          name
          ...SpanColumnSelector_annotations
          rootSpans: spans(
            first: $first
            after: $after
            sort: $sort
            rootSpansOnly: true
            filterCondition: $filterCondition
            timeRange: $timeRange
          ) @connection(key: "TracesTable_rootSpans") {
            edges {
              rootSpan: node {
                id
                spanKind
                name
                metadata
                statusCode
                startTime
                latencyMs
                cumulativeTokenCountTotal
                cumulativeTokenCountPrompt
                cumulativeTokenCountCompletion
                parentId
                input {
                  value: truncatedValue
                }
                output {
                  value: truncatedValue
                }
                spanId
                trace {
                  id
                  traceId
                  numSpans
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
                ...AnnotationSummaryGroup
                documentRetrievalMetrics {
                  evaluationName
                  ndcg
                  precision
                  hit
                }
                descendants(first: 50) {
                  edges {
                    node {
                      id
                      spanKind
                      name
                      statusCode: propagatedStatusCode
                      startTime
                      latencyMs
                      parentId
                      cumulativeTokenCountTotal: tokenCountTotal
                      cumulativeTokenCountPrompt: tokenCountPrompt
                      cumulativeTokenCountCompletion: tokenCountCompletion
                      input {
                        value: truncatedValue
                      }
                      output {
                        value: truncatedValue
                      }
                      spanId
                      trace {
                        id
                        traceId
                      }
                      spanAnnotations {
                        id
                        name
                        label
                        score
                        annotatorKind
                        createdAt
                      }
                      ...AnnotationSummaryGroup
                      documentRetrievalMetrics {
                        evaluationName
                        ndcg
                        precision
                        hit
                      }
                      ...TraceHeaderRootSpanAnnotationsFragment
                    }
                  }
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
    return data.rootSpans.edges.map(({ rootSpan }) => {
      // Construct the set of spans over which you want to construct the tree
      const spanTree = createSpanTree([
        rootSpan,
        ...rootSpan.descendants.edges.map(({ node }) => node),
      ]);
      // Unwrap the root span from the span tree and return it
      const [root] = spanTreeToNestedSpanTableRows({
        children: spanTree,
      });
      type SpanRowType = typeof root & IAdditionalSpansRow;
      // check if there are more spans in the tree than is loaded
      const numSpansNotLoaded = rootSpan.trace.numSpans - NUM_DESCENDANTS - 1;
      if (numSpansNotLoaded > 0) {
        root.children = [
          ...root.children,
          // We add a dummy span here to indicate that there are more spans in the tree
          {
            ...root,
            // Indicate that this is an additional row, not a span
            __additionalRow: true,
            name: `+ ${numSpansNotLoaded} more span${numSpansNotLoaded > 1 ? "s" : ""}`,
            id: `additional-${root.id}`,
            // Clear out the span info
            input: { value: "" },
            output: { value: "" },
            metadata: null,
            spanAnnotations: [],
            documentRetrievalMetrics: [],
            children: [],
          } as SpanRowType,
        ];
      }
      return root as SpanRowType;
    });
  }, [data]);
  type TableRow = (typeof tableData)[number];

  const dynamicAnnotationColumns: ColumnDef<TableRow>[] = useMemo(
    () =>
      visibleAnnotationColumnNames.map((name) => {
        return {
          header: name,
          columns: [
            {
              header: `labels`,
              accessorKey: makeAnnotationColumnId(name, "label"),
              cell: ({ row }) => {
                const annotation = (
                  row.original
                    .spanAnnotationSummaries as TracesTable_spans$data["rootSpans"]["edges"][number]["rootSpan"]["spanAnnotationSummaries"]
                )?.find((annotation) => annotation.name === name);
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
                const annotation = (
                  row.original
                    .spanAnnotationSummaries as TracesTable_spans$data["rootSpans"]["edges"][number]["rootSpan"]["spanAnnotationSummaries"]
                )?.find((annotation) => annotation.name === name);
                if (!annotation) {
                  return null;
                }
                return (
                  <MeanScore value={annotation.meanScore} fallback={null} />
                );
              },
            } as ColumnDef<TableRow>,
          ],
        };
      }),
    [visibleAnnotationColumnNames]
  );

  const annotationColumns: ColumnDef<TableRow>[] = useMemo(
    () => [
      {
        header: () => (
          <Flex direction="row" gap="size-50">
            <span>Annotations</span>
            <ContextualHelp>
              <Heading level={3} weight="heavy">
                Annotations
              </Heading>
              <Content>
                Evaluations and human annotations logged via the API or set via
                the UI.
              </Content>
            </ContextualHelp>
          </Flex>
        ),
        id: "annotations",
        accessorKey: "spanAnnotations",
        enableSorting: false,
        cell: ({ row }) => {
          if (row.original.__additionalRow) {
            return null;
          }
          const hasNoFeedback =
            row.original.spanAnnotations.length === 0 &&
            row.original.documentRetrievalMetrics.length === 0;
          return (
            <Flex direction="row" gap="size-50" wrap="wrap">
              <AnnotationSummaryGroupTokens
                span={row.original}
                showFilterActions
              />
              {row.original.documentRetrievalMetrics.map((retrievalMetric) => {
                return (
                  <Fragment key="doc-evals">
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
                  </Fragment>
                );
              })}
              {hasNoFeedback ? "--" : null}
            </Flex>
          );
        },
      },
      ...dynamicAnnotationColumns,
    ],
    [dynamicAnnotationColumns]
  );

  const columns: ColumnDef<TableRow>[] = useMemo(
    () => [
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
        cell: ({ row }) => {
          if (row.original.__additionalRow) {
            return null;
          }
          return (
            <IndeterminateCheckboxCell
              {...{
                checked: row.getIsSelected(),
                disabled: !row.getCanSelect(),
                indeterminate: row.getIsSomeSelected(),
                onChange: row.getToggleSelectedHandler(),
              }}
            />
          );
        },
      },
      {
        header: "status",
        accessorKey: "statusCode",
        maxSize: 30,
        enableSorting: false,
        cell: ({ getValue, row }) => {
          if (row.original.__additionalRow) {
            return null;
          }
          const statusCode = getValue() as SpanStatusCode;
          return <SpanStatusCodeIcon statusCode={statusCode} />;
        },
      },
      {
        header: ({ table }) => {
          return (
            <Flex gap="size-50" direction="row" alignItems="center">
              <TableExpandButton
                isExpanded={table.getIsAllRowsExpanded()}
                onClick={table.getToggleAllRowsExpandedHandler()}
                aria-label="Expand all rows"
              />
              kind
            </Flex>
          );
        },
        enableSorting: false,
        accessorKey: "spanKind",
        maxSize: 100,
        cell: (props) => {
          if (props.row.original.__additionalRow) {
            return (
              <div
                css={css`
                  // Since rows are flattened by default,
                  // we can use the row.depth property
                  // and paddingLeft to visually indicate the depth
                  // of the row
                  padding-left: ${props.row.depth * 2}rem;
                `}
              >
                <Icon svg={<Icons.MoreHorizontalOutline />} />
              </div>
            );
          }

          return (
            <div
              css={css`
                // Since rows are flattened by default,
                // we can use the row.depth property
                // and paddingLeft to visually indicate the depth
                // of the row
                padding-left: ${props.row.depth * 2}rem;
              `}
            >
              <Flex gap="size-50">
                {props.row.getCanExpand() ? (
                  <TableExpandButton
                    isExpanded={props.row.getIsExpanded()}
                    onClick={props.row.getToggleExpandedHandler()}
                    aria-label="Expand row"
                  />
                ) : null}
                <SpanKindToken spanKind={props.getValue() as string} />
              </Flex>
            </div>
          );
        },
      },
      {
        header: "name",
        accessorKey: "name",
        enableSorting: false,
        cell: ({ getValue, row }) => {
          const { traceId } = row.original.trace;
          const spanId = row.original.isAdditionalSpansRow
            ? null
            : row.original.id;
          return (
            <Link
              to={`${traceId}${spanId ? `?${SELECTED_SPAN_NODE_ID_PARAM}=${spanId}` : ""}`}
            >
              {getValue() as string}
            </Link>
          );
        },
      },
      {
        header: "input",
        accessorKey: "input.value",
        enableSorting: false,
        cell: TextCell,
      },
      {
        header: "output",
        accessorKey: "output.value",
        enableSorting: false,
        cell: TextCell,
      },
      {
        header: "metadata",
        accessorKey: "metadata",
        enableSorting: false,
        cell: MetadataCell,
      },
      ...annotationColumns, // TODO: consider hiding this column is there is no evals. For now show it
      {
        header: "start time",
        accessorKey: "startTime",
        cell: (props) => {
          if (props.row.original.__additionalRow) {
            return null;
          }
          return <TimestampCell {...props} />;
        },
      },
      {
        header: "latency",
        accessorKey: "latencyMs",
        cell: ({ getValue, row }) => {
          const value = getValue();
          if (
            value === null ||
            typeof value !== "number" ||
            row.original.__additionalRow
          ) {
            return null;
          }
          return <LatencyText latencyMs={value} />;
        },
      },
      {
        header: "total tokens",
        minSize: 80,
        accessorKey: "cumulativeTokenCountTotal",
        cell: ({ row, getValue }) => {
          if (row.original.__additionalRow) {
            return null;
          }
          const value = getValue();
          if (value === null) {
            return "--";
          }
          return (
            <TokenCount
              tokenCountTotal={value as number}
              tokenCountPrompt={row.original.cumulativeTokenCountPrompt || 0}
              tokenCountCompletion={
                row.original.cumulativeTokenCountCompletion || 0
              }
            />
          );
        },
      },
    ],
    [annotationColumns]
  );

  useEffect(() => {
    if (isFirstRender.current === true) {
      // Skip the first render. The data is already fetched by the parent
      isFirstRender.current = false;
      return;
    }
    //if the sorting changes, we need to reset the pagination
    const sort = sorting[0];
    startTransition(() => {
      refetch(
        {
          sort: sort ? getGqlSort(sort) : DEFAULT_SORT,
          after: null,
          first: PAGE_SIZE,
          filterCondition: filterCondition,
        },
        {
          fetchPolicy: "store-and-network",
        }
      );
    });
  }, [sorting, refetch, filterCondition, fetchKey]);

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

  const pagination = useTracePagination();
  const setTraceSequence = pagination?.setTraceSequence;
  useEffect(() => {
    if (!setTraceSequence) {
      return;
    }
    setTraceSequence(
      data.rootSpans.edges.map(({ rootSpan }) => ({
        traceId: rootSpan.trace.traceId,
        spanId: rootSpan.id,
      }))
    );
    return () => {
      setTraceSequence([]);
    };
  }, [data.rootSpans.edges, setTraceSequence]);

  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const setColumnSizing = useTracingContext((state) => state.setColumnSizing);
  const columnSizing = useTracingContext((state) => state.columnSizing);
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    onExpandedChange: setExpanded,
    manualSorting: true,
    getSubRows: (row) => row.children,
    state: {
      sorting,
      expanded,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    enableSubRowSelection: false,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row.id,
  });
  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().flatRows;
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
                    colSpan={header.colSpan}
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          data-sortable={header.column.getCanSort()}
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
                          <Truncate maxWidth="100%">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </Truncate>
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
            <MemoizedTableBody
              table={
                // We can't access the internal TableRowType in the TableBody component
                // so we cast to unknown and then to the correct type
                table as unknown as ComponentProps<typeof TableBody>["table"]
              }
            />
          ) : (
            <TableBody
              table={
                // We can't access the internal TableRowType in the TableBody component
                // so we cast to unknown and then to the correct type
                table as unknown as ComponentProps<typeof TableBody>["table"]
              }
            />
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
