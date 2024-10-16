/* eslint-disable react/prop-types */
import React, {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Content,
  ContextualHelp,
  Flex,
  Heading,
  Icon,
  Icons,
  View,
} from "@arizeai/components";

import {
  AnnotationLabel,
  AnnotationTooltip,
} from "@phoenix/components/annotation";
import { Link } from "@phoenix/components/Link";
import { TextCell } from "@phoenix/components/table";
import { IndeterminateCheckboxCell } from "@phoenix/components/table/IndeterminateCheckboxCell";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableExpandButton } from "@phoenix/components/table/TableExpandButton";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindLabel } from "@phoenix/components/trace/SpanKindLabel";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { ISpanItem } from "@phoenix/components/trace/types";
import { createSpanTree, SpanTreeNode } from "@phoenix/components/trace/utils";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import {
  SpanStatusCode,
  TracesTable_spans$key,
} from "./__generated__/TracesTable_spans.graphql";
import { TracesTableQuery } from "./__generated__/TracesTableQuery.graphql";
import { AnnotationTooltipFilterActions } from "./AnnotationTooltipFilterActions";
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
type TracesTableProps = {
  project: TracesTable_spans$key;
};

const PAGE_SIZE = 50;

/**
 * A nested table row is a span with a children that recursively
 * contains more nested table rows.
 */
type NestedSpanTableRow<TSpan extends ISpanItem> = TSpan & {
  children: NestedSpanTableRow<TSpan>[];
};

/**
 * Recursively create a nested table rows to display the span tree
 * as a table.
 */
function spanTreeToNestedSpanTableRows<TSpan extends ISpanItem>(
  children: SpanTreeNode<TSpan>[]
): NestedSpanTableRow<TSpan>[] {
  const normalizedSpanTreeChildren: NestedSpanTableRow<TSpan>[] = [];
  for (const child of children) {
    const normalizedChild = {
      ...child.span,
      children: spanTreeToNestedSpanTableRows(child.children),
    };
    normalizedSpanTreeChildren.push(normalizedChild);
  }
  return normalizedSpanTreeChildren;
}

export function TracesTable(props: TracesTableProps) {
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const navigate = useNavigate();
  const { fetchKey } = useStreamState();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<TracesTableQuery, TracesTable_spans$key>(
      graphql`
        fragment TracesTable_spans on Project
        @refetchable(queryName: "TracesTableQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 50 }
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
                statusCode: propagatedStatusCode
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
                context {
                  spanId
                  traceId
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
                descendants {
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
                    value
                  }
                  output {
                    value
                  }
                  context {
                    spanId
                    traceId
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
    const tableData = data.rootSpans.edges.map(({ rootSpan }) => {
      // Construct the set of spans over which you want to construct the tree
      const spanTree = createSpanTree([rootSpan, ...rootSpan.descendants]);
      // Unwrap the root span from the span tree and return it
      const [root] = spanTreeToNestedSpanTableRows(spanTree);
      return root;
    });

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
      accessorKey: "spanAnnotations",
      enableSorting: false,
      cell: ({ row }) => {
        const hasNoFeedback =
          row.original.spanAnnotations.length === 0 &&
          row.original.documentRetrievalMetrics.length === 0;
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
      header: () => {
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
              <SpanKindLabel spanKind={props.getValue() as string} />
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
        const { traceId } = row.original.context;
        return (
          <Link to={`traces/${traceId}?selectedSpanNodeId=${row.original.id}`}>
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
      cell: TextCell,
    },
    ...annotationColumns, // TODO: consider hiding this column is there is no evals. For now show it
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
      header: "total tokens",
      minSize: 80,
      accessorKey: "cumulativeTokenCountTotal",
      cell: ({ row, getValue }) => {
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
    {
      header: "status",
      accessorKey: "statusCode",
      enableSorting: false,
      cell: ({ getValue }) => {
        return <SpanStatusCodeIcon statusCode={getValue() as SpanStatusCode} />;
      },
    },
  ];

  useEffect(() => {
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
  const fetchMoreOnBottomReached = React.useCallback(
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
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columnVisibility = useTracingContext((state) => state.columnVisibility);
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
    },
    onRowSelectionChange: setRowSelection,
    enableSubRowSelection: false,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row.id,
  });
  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().flatRows;
  const selectedSpans = selectedRows.map((row) => row.original);
  const clearSelection = useCallback(() => {
    setRowSelection({});
  }, [setRowSelection]);
  const isEmpty = rows.length === 0;
  const computedColumns = table.getAllColumns().filter((column) => {
    // Filter out columns that are eval groupings
    return column.columns.length === 0;
  });

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
        <table css={selectableTableCSS}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th colSpan={header.colSpan} key={header.id}>
                    {header.isPlaceholder ? null : (
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
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {isEmpty ? (
            <ProjectTableEmpty projectName={data.name} />
          ) : (
            <tbody>
              {rows.map((row) => {
                return (
                  <tr
                    key={row.id}
                    onClick={() =>
                      navigate(`traces/${row.original.context.traceId}`)
                    }
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <td key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
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
