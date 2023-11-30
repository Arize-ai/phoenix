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
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import {
  SpanStatusCode,
  TracesTable_spans$key,
} from "./__generated__/TracesTable_spans.graphql";
import {
  SpanSort,
  TracesTableQuery,
} from "./__generated__/TracesTableQuery.graphql";
import { EvaluationLabel } from "./EvaluationLabel";
import { SpanColumnSelector } from "./SpanColumnSelector";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { spansTableCSS } from "./styles";
import { TokenCount } from "./TokenCount";
type TracesTableProps = {
  query: TracesTable_spans$key;
};

const PAGE_SIZE = 100;
const DEFAULT_SORT: SpanSort = {
  col: "startTime",
  dir: "desc",
};

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
  const isEvalsEnabled = useFeatureFlag("evals");
  const navigate = useNavigate();
  const { fetchKey } = useStreamState();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<TracesTableQuery, TracesTable_spans$key>(
      graphql`
        fragment TracesTable_spans on Query
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
          rootSpans: spans(
            first: $first
            after: $after
            sort: $sort
            rootSpansOnly: true
            filterCondition: $filterCondition
          ) @connection(key: "TracesTable_rootSpans") {
            edges {
              rootSpan: node {
                spanKind
                name
                statusCode: propagatedStatusCode
                startTime
                latencyMs
                tokenCountTotal: cumulativeTokenCountTotal
                tokenCountPrompt: cumulativeTokenCountPrompt
                tokenCountCompletion: cumulativeTokenCountCompletion
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
                descendants {
                  spanKind
                  name
                  statusCode: propagatedStatusCode
                  startTime
                  latencyMs
                  parentId
                  tokenCountTotal
                  tokenCountPrompt
                  tokenCountCompletion
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
                }
              }
            }
          }
        }
      `,
      props.query
    );

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

  const evaluationColumns: ColumnDef<TableRow>[] = [
    {
      header: "evaluations",
      accessorKey: "spanEvaluations",
      enableSorting: false,

      cell: ({ row }) => {
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
          </Flex>
        );
      },
    },
  ];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: () => {
        return (
          <Flex gap="size-50">
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
          <Link to={`/tracing/traces/${traceId}?selectedSpanId=${spanId}`}>
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
    ...(isEvalsEnabled ? evaluationColumns : []),
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
      accessorKey: "tokenCountTotal",
      cell: ({ row, getValue }) => {
        const value = getValue();
        if (value === null) {
          return "--";
        }
        return (
          <TokenCount
            tokenCountTotal={value as number}
            tokenCountPrompt={row.original.tokenCountPrompt || 0}
            tokenCountCompletion={row.original.tokenCountCompletion || 0}
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
          sort: sort
            ? {
                col: sort.id as SpanSort["col"],
                dir: sort.desc ? "desc" : "asc",
              }
            : DEFAULT_SORT,
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
  const computedColumns = table.getAllColumns();

  return (
    <div css={spansTableCSS}>
      <View
        paddingTop="size-100"
        paddingBottom="size-100"
        paddingStart="size-200"
        paddingEnd="size-200"
        backgroundColor="grey-200"
        flex="none"
      >
        <Flex direction="row" gap="size-100" width="100%" alignItems="center">
          <SpanFilterConditionField onValidCondition={setFilterCondition} />
          <SpanColumnSelector columns={computedColumns} />
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
                        {...{
                          className: header.column.getCanSort()
                            ? "cursor-pointer"
                            : "",
                          onClick: header.column.getToggleSortingHandler(),
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
