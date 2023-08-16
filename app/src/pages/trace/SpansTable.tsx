import React, { startTransition, useCallback, useMemo, useState } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { formatDuration, intervalToDuration } from "date-fns";

import {
  Button,
  Flex,
  Icon,
  Icons,
  ProgressCircle,
  Text,
} from "@arizeai/components";

import { paginationCSS, tableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { SpanKindLabel } from "@phoenix/components/trace/SpanKindLabel";

import { SpansTable_spans$key } from "./__generated__/SpansTable_spans.graphql";
import { SpansTableSpansQuery } from "./__generated__/SpansTableSpansQuery.graphql";
type SpansTableProps = {
  query: SpansTable_spans$key;
};

const PAGE_SIZE = 25;
export function SpansTable(props: SpansTableProps) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SpansTableSpansQuery,
    SpansTable_spans$key
  >(
    graphql`
      fragment SpansTable_spans on Query
      @refetchable(queryName: "SpansTableSpansQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 25 }
        last: { type: "Int" }
        before: { type: "String" }
        sort: { type: "SpanSort", defaultValue: { col: startTime, dir: desc } }
      ) {
        spans(
          first: $first
          after: $after
          last: $last
          before: $before
          sort: $sort
        ) @connection(key: "SpansTable_spans") {
          edges {
            span: node {
              spanKind
              name
              startTime
              latencyMs
              context {
                spanId
                traceId
              }
            }
          }
        }
      }
    `,
    props.query
  );

  const tableData = useMemo(() => {
    const tableData = data.spans.edges.map(({ span }) => {
      // Normalize the data
      return {
        ...span,
        trace_id: span.context.traceId,
        span_id: span.context.spanId,
      };
    });

    return tableData;
  }, [data]);
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "kind",
      accessorKey: "spanKind",
      cell: ({ getValue }) => {
        return <SpanKindLabel spanKind={getValue() as string} />;
      },
    },
    {
      header: "name",
      accessorKey: "name",
    },
    {
      header: "start time",
      accessorKey: "startTime",
      cell: TimestampCell,
    },
    {
      header: "latency",
      accessorKey: "latencyMs",
      cell: ({ getValue }) =>
        formatDuration(
          intervalToDuration({ start: 0, end: getValue() as number })
        ),
    },
  ];

  const [pageIndex, _setPageIndex] = useState<number>(0);

  const setPageIndex = useCallback(
    (index: number) => {
      startTransition(() => {
        if (index > pageIndex) {
          loadNext(PAGE_SIZE, { onComplete: () => _setPageIndex(index) });
        } else {
          _setPageIndex(index);
        }
      });
    },
    [loadNext, pageIndex]
  );
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      pagination: {
        pageIndex,
        pageSize: PAGE_SIZE,
      },
    },
    pageCount: hasNext ? pageIndex + 2 : pageIndex + 1,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  return (
    <>
      <table css={tableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => {
            return (
              <tr key={row.id}>
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
      </table>
      <div css={paginationCSS}>
        {isLoadingNext ? (
          <Flex gap={"size-100"}>
            <ProgressCircle isIndeterminate size="S" />
            <Text textSize="small" color="white70">
              Loading...
            </Text>
          </Flex>
        ) : null}
        <Button
          variant="default"
          size="compact"
          onClick={() => setPageIndex(pageIndex - 1)}
          disabled={pageIndex === 0}
          aria-label="Previous Page"
          icon={<Icon svg={<Icons.ArrowIosBackOutline />} />}
        />

        <Button
          variant="default"
          size="compact"
          onClick={() => setPageIndex(pageIndex + 1)}
          aria-label="Next Page"
          icon={<Icon svg={<Icons.ArrowIosForwardOutline />} />}
        />
      </div>
    </>
  );
}
