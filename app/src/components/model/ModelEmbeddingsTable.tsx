import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { ColumnDef } from "@tanstack/react-table";

import { Link } from "@phoenix/components";
import { FloatCell } from "@phoenix/components/table";
import { Table } from "@phoenix/components/table/Table";

import { ModelEmbeddingsTable_embeddingDimensions$key } from "./__generated__/ModelEmbeddingsTable_embeddingDimensions.graphql";

type ModelEmbeddingsTableProps = {
  model: ModelEmbeddingsTable_embeddingDimensions$key;
};

export function ModelEmbeddingsTable(props: ModelEmbeddingsTableProps) {
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
  type TableRow = (typeof tableData)[number];
  const columns = React.useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "name",
        accessorKey: "name",
        cell: ({ row, renderValue }) => (
          <Link to={`embeddings/${row.original.id}`}>
            {renderValue() as string}
          </Link>
        ),
      },
      {
        header: "euclidean distance",
        accessorKey: "euclideanDistance",
        cell: FloatCell,
      },
    ];
    return cols;
  }, []);

  // Render the UI for your table
  return <Table columns={columns} data={tableData} />;
}
