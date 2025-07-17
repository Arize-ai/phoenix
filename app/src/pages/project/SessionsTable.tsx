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
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Icon, Icons, View } from "@phoenix/components";
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SessionTokenCosts } from "@phoenix/components/trace/SessionTokenCosts";
import { SessionTokenCount } from "@phoenix/components/trace/SessionTokenCount";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { IntCell, TextCell } from "../../components/table";

import { SessionsTable_sessions$key } from "./__generated__/SessionsTable_sessions.graphql";
import {
  ProjectSessionColumn,
  SessionsTableQuery,
} from "./__generated__/SessionsTableQuery.graphql";
import { DEFAULT_PAGE_SIZE } from "./constants";
import { useSessionSearchContext } from "./SessionSearchContext";
import { SessionSearchField } from "./SessionSearchField";
import { SessionsTableEmpty } from "./SessionsTableEmpty";
import { spansTableCSS } from "./styles";
type SessionsTableProps = {
  project: SessionsTable_sessions$key;
};

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const TableBody = <T extends { id: string }>({
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
            onClick={() => navigate(`${encodeURIComponent(row.id)}`)}
          >
            {row.getVisibleCells().map((cell) => {
              return (
                <td
                  key={cell.id}
                  style={{
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

export function SessionsTable(props: SessionsTableProps) {
  // we need a reference to the scrolling element for pagination logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { filterIoSubstringOrSessionId } = useSessionSearchContext();
  const { fetchKey } = useStreamState();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<SessionsTableQuery, SessionsTable_sessions$key>(
      graphql`
        fragment SessionsTable_sessions on Project
        @refetchable(queryName: "SessionsTableQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 30 }
          sort: {
            type: "ProjectSessionSort"
            defaultValue: { col: startTime, dir: desc }
          }
          filterIoSubstring: { type: "String", defaultValue: null }
          sessionId: { type: "String", defaultValue: null }
        ) {
          name
          sessions(
            first: $first
            after: $after
            sort: $sort
            filterIoSubstring: $filterIoSubstring
            timeRange: $timeRange
            sessionId: $sessionId
          ) @connection(key: "SessionsTable_sessions") {
            edges {
              session: node {
                id
                sessionId
                numTraces
                startTime
                endTime
                firstInput {
                  value
                }
                lastOutput {
                  value
                }
                tokenUsage {
                  total
                }
                traceLatencyMsP50: traceLatencyMsQuantile(probability: 0.5)
                traceLatencyMsP99: traceLatencyMsQuantile(probability: 0.99)
                costSummary {
                  total {
                    cost
                  }
                }
              }
            }
          }
        }
      `,
      props.project
    );
  const tableData = useMemo(() => {
    return data.sessions.edges.map(({ session }) => ({
      ...session,
      tokenCountTotal: session.tokenUsage.total,
      costTotal: session.costSummary?.total?.cost ?? null,
    }));
  }, [data.sessions]);
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "session id",
      accessorKey: "sessionId",
      enableSorting: false,
      cell: TextCell,
    },
    {
      header: "first input",
      accessorKey: "firstInput.value",
      enableSorting: false,
      cell: TextCell,
    },
    {
      header: "last output",
      accessorKey: "lastOutput.value",
      enableSorting: false,
      cell: TextCell,
    },
    {
      header: "start time",
      accessorKey: "startTime",
      enableSorting: true,
      cell: TimestampCell,
    },
    {
      header: "end time",
      accessorKey: "endTime",
      enableSorting: true,
      cell: TimestampCell,
    },
    {
      header: "p50 latency",
      accessorKey: "traceLatencyMsP50",
      enableSorting: false,
      cell: ({ getValue }) => {
        const value = getValue();
        if (value === null || typeof value !== "number") {
          return null;
        }
        return <LatencyText latencyMs={value} />;
      },
    },
    {
      header: "p99 latency",
      accessorKey: "traceLatencyMsP99",
      enableSorting: false,
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
      enableSorting: true,
      minSize: 80,
      cell: ({ getValue, row }) => {
        const value = getValue();
        if (value == null || typeof value !== "number") {
          return "--";
        }
        const session = row.original;
        return (
          <SessionTokenCount
            tokenCountTotal={value as number}
            nodeId={session.id}
            size="S"
          />
        );
      },
    },
    {
      header: "total cost",
      accessorKey: "costSummary.total.cost",
      id: "costTotal",
      enableSorting: true,
      minSize: 80,
      cell: ({ row, getValue }) => {
        const value = getValue();
        if (value === null || typeof value !== "number") {
          return "--";
        }
        const session = row.original;
        return <SessionTokenCosts totalCost={value} nodeId={session.id} />;
      },
    },
    {
      header: "total traces",
      accessorKey: "numTraces",
      enableSorting: true,
      cell: IntCell,
    },
  ];
  useEffect(() => {
    const sort = sorting[0];
    startTransition(() => {
      refetch(
        {
          sort: sort
            ? {
                col: sort.id as ProjectSessionColumn,
                dir: sort.desc ? "desc" : "asc",
              }
            : { col: "startTime", dir: "desc" },
          after: null,
          first: PAGE_SIZE,
          filterIoSubstring: filterIoSubstringOrSessionId,
          sessionId: filterIoSubstringOrSessionId,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [sorting, refetch, filterIoSubstringOrSessionId, fetchKey]);
  const fetchMoreOnBottomReached = React.useCallback(
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
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const columnSizing = useTracingContext((state) => state.columnSizing);
  const setColumnSizing = useTracingContext((state) => state.setColumnSizing);
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    onExpandedChange: setExpanded,
    manualSorting: true,
    state: {
      sorting,
      expanded,
      columnVisibility,
      columnSizing,
    },
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    enableSubRowSelection: false,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row.id,
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const { columnSizingInfo, columnSizing: columnSizingState } =
    table.getState();
  const getFlatHeaders = table.getFlatHeaders;
  const colLength = columns.length;
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
        <SessionSearchField />
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
                          data-sortable={header.column.getCanSort()}
                          {...{
                            className: header.column.getCanSort() ? "sort" : "",
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
            <SessionsTableEmpty />
          ) : columnSizingInfo.isResizingColumn ? (
            <MemoizedTableBody table={table} />
          ) : (
            <TableBody table={table} />
          )}
        </table>
      </div>
    </div>
  );
}
