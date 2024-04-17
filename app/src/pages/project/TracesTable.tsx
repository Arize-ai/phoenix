/* eslint-disable react/prop-types */
import React, {
  startTransition,
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

import { Flex, Icon, Icons, View } from "@arizeai/components";

import { Link } from "@phoenix/components/Link";
import { TextCell } from "@phoenix/components/table";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TableExpandButton } from "@phoenix/components/table/TableExpandButton";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindLabel } from "@phoenix/components/trace/SpanKindLabel";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { ISpanItem } from "@phoenix/components/trace/types";
import { createSpanTree, SpanTreeNode } from "@phoenix/components/trace/utils";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import {
  SpanStatusCode,
  TracesTable_spans$key,
} from "./__generated__/TracesTable_spans.graphql";
import { TracesTableQuery } from "./__generated__/TracesTableQuery.graphql";
import { EvaluationLabel } from "./EvaluationLabel";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";
import { SpanColumnSelector } from "./SpanColumnSelector";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { spansTableCSS } from "./styles";
import {
  DEFAULT_SORT,
  EVALS_COLUMN_PREFIX,
  EVALS_KEY_SEPARATOR,
  getGqlSort,
} from "./tableUtils";
import { TokenCount } from "./TokenCount";
type TracesTableProps = {
  project: TracesTable_spans$key;
};

const PAGE_SIZE = 100;

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
          first: { type: "Int", defaultValue: 100 }
          sort: {
            type: "SpanSort"
            defaultValue: { col: startTime, dir: desc }
          }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          ...SpanColumnSelector_evaluations
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
                  value
                }
                output {
                  value
                }
                context {
                  spanId
                  traceId
                }
                spanEvaluations {
                  name
                  label
                  score
                }
                documentRetrievalMetrics {
                  evaluationName
                  ndcg
                  precision
                  hit
                }
                descendants {
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
                  spanEvaluations {
                    name
                    label
                    score
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

  const evaluationVisibility = useTracingContext(
    (state) => state.evaluationVisibility
  );
  const visibleEvaluationColumnNames = useMemo(() => {
    return Object.keys(evaluationVisibility).filter(
      (name) => evaluationVisibility[name]
    );
  }, [evaluationVisibility]);
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

  const dynamicEvaluationColumns: ColumnDef<TableRow>[] =
    visibleEvaluationColumnNames.map((name) => {
      return {
        header: name,
        columns: [
          {
            header: `label`,
            accessorKey: `${EVALS_COLUMN_PREFIX}${EVALS_KEY_SEPARATOR}label${EVALS_KEY_SEPARATOR}${name}`,
            cell: ({ row }) => {
              const evaluation = row.original.spanEvaluations.find(
                (evaluation) => evaluation.name === name
              );
              if (!evaluation) {
                return null;
              }
              return evaluation.label;
            },
          } as ColumnDef<TableRow>,
          {
            header: `score`,
            accessorKey: `${EVALS_COLUMN_PREFIX}${EVALS_KEY_SEPARATOR}score${EVALS_KEY_SEPARATOR}${name}`,
            cell: ({ row }) => {
              const evaluation = row.original.spanEvaluations.find(
                (evaluation) => evaluation.name === name
              );
              if (!evaluation) {
                return null;
              }
              return evaluation.score;
            },
          } as ColumnDef<TableRow>,
        ],
      };
    });

  const evaluationColumns: ColumnDef<TableRow>[] = [
    {
      header: "evaluations",
      accessorKey: "spanEvaluations",
      enableSorting: false,
      cell: ({ row }) => {
        const hasNoEvaluations =
          row.original.spanEvaluations.length === 0 &&
          row.original.documentRetrievalMetrics.length === 0;
        return (
          <Flex direction="row" gap="size-50" wrap="wrap">
            {row.original.spanEvaluations.map((evaluation) => {
              return (
                <EvaluationLabel
                  key={evaluation.name}
                  evaluation={evaluation}
                />
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
            {hasNoEvaluations ? "--" : null}
          </Flex>
        );
      },
    },
    ...dynamicEvaluationColumns,
  ];

  const columns: ColumnDef<TableRow>[] = [
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
        const { spanId, traceId } = row.original.context;
        return (
          <Link to={`traces/${traceId}?selectedSpanId=${spanId}`}>
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
    ...evaluationColumns, // TODO: consider hiding this column is there is no evals. For now show it
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
    getSubRows: (row) => row.children,
    state: {
      sorting,
      expanded,
      columnVisibility,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  const rows = table.getRowModel().rows;
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
            <TableEmpty />
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
    </div>
  );
}
