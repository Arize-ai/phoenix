import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { Table } from "../table/Table";
import { Column } from "react-table";

// type ModelSchemaTableProps = {
//   model: ModelSchemaTable_dimensions$key;
// };

export function ModelEmbeddingsTable(props: any) {
  const { data } = usePaginationFragment(
    graphql`
      fragment ModelEmbeddingsTable_dimensions on Query
      @refetchable(queryName: "ModelEmbeddingsTableEmbeddingDimensionsQuery")
      @argumentDefinitions(
        count: { type: "Int", defaultValue: 50 }
        cursor: { type: "String", defaultValue: null }
      ) {
        model {
          embeddings(first: $count, after: $cursor)
            @connection(key: "ModelEmbeddingsTable_embeddings") {
            edges {
              embedding: node {
                name
            }
          }
        }
      }
    `,
    props.model
  );
  const tableData = useMemo(
    () =>
      data.model.dimensions.edges.map(({ embedding }) => {
        // Normalize the data
        return {
          ...embedding,
        };
      }),
    [data]
  );

  // Declare the columns
  const columns = React.useMemo(() => {
    const cols: Column<typeof tableData[number]>[] = [
      {
        Header: "Name",
        accessor: "name",
      },
    ];
    return cols;
  }, []);

  // Render the UI for your table
  return <Table columns={columns} data={tableData} />;
}
