import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { ColumnDef } from "@tanstack/react-table";
import { formatDuration, intervalToDuration } from "date-fns";

import { Table } from "@phoenix/components/table";

import { SpansTable_spans$key } from "./__generated__/SpansTable_spans.graphql";
type SpansTableProps = {
  query: SpansTable_spans$key;
};
export function SpansTable(props: SpansTableProps) {
  const { data } = usePaginationFragment(
    graphql`
      fragment SpansTable_spans on Query
      @refetchable(queryName: "SpansTableSpansQuery")
      @argumentDefinitions(
        count: { type: "Int", defaultValue: 50 }
        cursor: { type: "String", defaultValue: null }
        sort: { type: "SpanSort", defaultValue: { col: startTime, dir: desc } }
      ) {
        spans(first: $count, after: $cursor, sort: $sort)
          @connection(key: "SpansTable_spans") {
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

  const tableData = useMemo(
    () =>
      data.spans.edges.map(({ span }) => {
        // Normalize the data
        return {
          ...span,
          trace_id: span.context.traceId,
          span_id: span.context.spanId,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "trace_id",
      accessorKey: "trace_id",
    },
    {
      header: "span_id",
      accessorKey: "span_id",
    },
    {
      header: "kind",
      accessorKey: "spanKind",
    },
    {
      header: "name",
      accessorKey: "name",
    },
    { header: "start time", accessorKey: "startTime" },
    {
      header: "latency",
      accessorKey: "latencyMs",
      cell: ({ getValue }) =>
        formatDuration(
          intervalToDuration({ start: 0, end: getValue() as number })
        ),
    },
  ];
  return <Table columns={columns} data={tableData} />;
}
