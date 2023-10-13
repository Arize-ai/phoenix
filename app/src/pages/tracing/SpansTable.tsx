import React, { startTransition, useEffect, useMemo, useState } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useNavigate } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Icon, Icons, View } from "@arizeai/components";

import { Link } from "@phoenix/components/Link";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TextCell } from "@phoenix/components/table/TextCell";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindLabel } from "@phoenix/components/trace/SpanKindLabel";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";

import {
  SpansTable_spans$key,
  SpanStatusCode,
} from "./__generated__/SpansTable_spans.graphql";
import {
  SpanSort,
  SpansTableSpansQuery,
} from "./__generated__/SpansTableSpansQuery.graphql";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { TokenCount } from "./TokenCount";
type SpansTableProps = {
  query: SpansTable_spans$key;
};

const PAGE_SIZE = 100;
const DEFAULT_SORT: SpanSort = {
  col: "startTime",
  dir: "desc",
};
export function SpansTable(props: SpansTableProps) {
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const navigate = useNavigate();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<SpansTableSpansQuery, SpansTable_spans$key>(
      graphql`
        fragment SpansTable_spans on Query
        @refetchable(queryName: "SpansTableSpansQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 100 }
          sort: {
            type: "SpanSort"
            defaultValue: { col: startTime, dir: desc }
          }
          filterCondition: { type: "String", defaultValue: null }
        ) {
          spans(
            first: $first
            after: $after
            sort: $sort
            filterCondition: $filterCondition
          ) @connection(key: "SpansTable_spans") {
            edges {
              span: node {
                spanKind
                name
                statusCode
                startTime
                latencyMs
                tokenCountTotal
                tokenCountPrompt
                tokenCountCompletion
                context {
                  spanId
                  traceId
                }
                input {
                  value
                  mimeType
                }
                output {
                  value
                  mimeType
                }
              }
            }
          }
        }
      `,
      props.query
    );

  const tableData = useMemo(() => {
    const tableData = data.spans.edges.map(({ span }) => span);

    return tableData;
  }, [data]);
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "kind",
      accessorKey: "spanKind",
      enableSorting: false,
      cell: ({ getValue }) => {
        return <SpanKindLabel spanKind={getValue() as string} />;
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
      refetch({
        sort: sort
          ? {
              col: sort.id as SpanSort["col"],
              dir: sort.desc ? "desc" : "asc",
            }
          : DEFAULT_SORT,
        after: null,
        first: PAGE_SIZE,
        filterCondition,
      });
    });
  }, [sorting, refetch, filterCondition]);
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
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  return (
    <div>
      <div>
        <View padding="size-100" backgroundColor="light">
          <SpanFilterConditionField onValidCondition={setFilterCondition} />
        </View>
      </div>
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
                      navigate(
                        `traces/${row.original.context.traceId}?selectedSpanId=${row.original.context.spanId}`
                      )
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
