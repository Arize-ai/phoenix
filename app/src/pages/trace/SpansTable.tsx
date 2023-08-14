import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { Column } from "react-table";
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
  const columns: Column<TableRow>[] = [
    {
      Header: "trace_id",
      accessor: "trace_id",
    },
    {
      Header: "span_id",
      accessor: "span_id",
    },
    {
      Header: "kind",
      accessor: "spanKind",
    },
    {
      Header: "name",
      accessor: "name",
    },
    { Header: "start time", accessor: "startTime" },
    {
      Header: "latency",
      accessor: "latencyMs",
      Cell: ({ value }) =>
        formatDuration(intervalToDuration({ start: 0, end: value })),
    },
  ];
  return <Table columns={columns} data={tableData} />;
}
