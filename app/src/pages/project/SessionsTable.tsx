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
import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { IntCell, TextCell } from "../../components/table";
import { LatencyText } from "../../components/trace/LatencyText";
import { TokenCount } from "../../components/trace/TokenCount";

import { SessionsTable_sessions$key } from "./__generated__/SessionsTable_sessions.graphql";
import { SessionsTableQuery } from "./__generated__/SessionsTableQuery.graphql";
import { ProjectTableEmpty } from "./ProjectTableEmpty";
import { SpanFilterConditionField } from "./SpanFilterConditionField";
import { spansTableCSS } from "./styles";

type SessionsTableProps = {
  project: SessionsTable_sessions$key;
};

const PAGE_SIZE = 50;

export function SessionsTable(props: SessionsTableProps) {
  //we need a reference to the scrolling element for logic down below
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterCondition, setFilterCondition] = useState<string>("");
  const navigate = useNavigate();
  const { fetchKey } = useStreamState();
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<SessionsTableQuery, SessionsTable_sessions$key>(
      graphql`
        fragment SessionsTable_sessions on Project
        @refetchable(queryName: "SessionsTableQuery")
        @argumentDefinitions(
          after: { type: "String", defaultValue: null }
          first: { type: "Int", defaultValue: 50 }
        ) {
          name
          sessions(first: $first, after: $after, timeRange: $timeRange)
            @connection(key: "SessionsTable_sessions") {
            edges {
              session: node {
                id
                sessionId
                sessionUser
                numSpans
                timeInterval {
                  start
                  durationMs
                }
                firstInputMessage {
                  role
                  content
                }
                lastOutputMessage {
                  role
                  content
                }
                tokenUsage {
                  prompt
                  completion
                  total
                }
              }
            }
          }
        }
      `,
      props.project
    );
  const tableData = useMemo(() => {
    return data.sessions.edges.map(({ session }) => session);
  }, [data]);
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "session id",
      accessorKey: "sessionId",
      enableSorting: false,
      cell: ({ getValue, row }) => {
        const { id } = row.original;
        return (
          <Link to={`sessions/${encodeURIComponent(id)}`}>
            {getValue() as string}
          </Link>
        );
      },
    },
    {
      header: "session user",
      accessorKey: "sessionUser",
      cell: TextCell,
    },
    {
      header: "num spans",
      accessorKey: "numSpans",
      cell: IntCell,
    },
    {
      header: "first input message",
      accessorKey: "firstInputMessage.content",
      cell: TextCell,
    },
    {
      header: "last output message",
      accessorKey: "lastOutputMessage.content",
      cell: TextCell,
    },
    {
      header: "start time",
      accessorKey: "timeInterval.start",
      cell: TimestampCell,
    },
    {
      header: "duration",
      accessorKey: "timeInterval.durationMs",
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
      accessorKey: "tokenUsage.total",
      minSize: 80,
      cell: ({ row, getValue }) => {
        const value = getValue();
        if (value === null) {
          return "--";
        }
        const { prompt, completion } = row.original.tokenUsage;
        return (
          <TokenCount
            tokenCountTotal={value as number}
            tokenCountPrompt={prompt || 0}
            tokenCountCompletion={completion || 0}
          />
        );
      },
    },
  ];
  useEffect(() => {
    //if the sorting changes, we need to reset the pagination
    // const sort = sorting[0];
    startTransition(() => {
      refetch(
        {
          after: null,
          first: PAGE_SIZE,
        },
        { fetchPolicy: "store-and-network" }
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
    state: {
      sorting,
      expanded,
      columnVisibility,
    },
    enableSubRowSelection: false,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row.id,
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
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
                    onClick={() => navigate(`sessions/${row.id}`)}
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
