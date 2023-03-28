import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { CellProps, Column } from "react-table";

import { Link } from "@phoenix/components";
import { FloatCell } from "@phoenix/components/table";
import { Table } from "@phoenix/components/table/Table";

import { ModelEmbeddingsTable_embeddingDimensions$key } from "./__generated__/ModelEmbeddingsTable_embeddingDimensions.graphql";

type ModelEmbeddingsTable = {
  model: ModelEmbeddingsTable_embeddingDimensions$key;
};

export function ModelEmbeddingsTable(props: ModelEmbeddingsTable) {
  const { data } = usePaginationFragment(
    graphql`
      fragment ModelEmbeddingsTable_embeddingDimensions on Query
      @refetchable(queryName: "ModelEmbeddingsTableEmbeddingDimensionsQuery")
      @argumentDefinitions(
        count: { type: "Int", defaultValue: 50 }
        cursor: { type: "String", defaultValue: null }
        startTime: { type: "DateTime!" }
        endTime: { type: "DateTime!" }
      ) {
        model {
          embeddingDimensions(first: $count, after: $cursor)
            @connection(key: "ModelEmbeddingsTable_embeddingDimensions") {
            edges {
              embedding: node {
                id
                name
                euclideanDistance: driftMetric(
                  metric: euclideanDistance
                  timeRange: { start: $startTime, end: $endTime }
                )
              }
            }
          }
        }
      }
    `,
    props.model
  );
  const tableData = useMemo(
    () =>
      data.model.embeddingDimensions.edges.map(({ embedding }) => {
        // Normalize the data
        return {
          ...embedding,
        };
      }),
    [data]
  );

  // Declare the columns
  type TableRow = typeof tableData[number];
  const columns = React.useMemo(() => {
    const cols: Column<TableRow>[] = [
      {
        Header: "name",
        accessor: "name",
        Cell: ({ row, value }: CellProps<TableRow, string>) => (
          <Link to={`/embeddings/${row.original.id}`}>{value}</Link>
        ),
      },
      {
        Header: "euclidean distance",
        accessor: "euclideanDistance",
        Cell: FloatCell,
      },
    ];
    return cols;
  }, []);

  // Render the UI for your table
  return <Table columns={columns} data={tableData} />;
}
