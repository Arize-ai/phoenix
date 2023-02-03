import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { ModelSchemaTable_dimensions$key } from "./__generated__/ModelSchemaTable_dimensions.graphql";
import { Table } from "../table/Table";
import { Column } from "react-table";

type ModelSchemaTableProps = {
  model: ModelSchemaTable_dimensions$key;
};

export function ModelSchemaTable(props: ModelSchemaTableProps) {
  const { data } = usePaginationFragment(
    graphql`
      fragment ModelSchemaTable_dimensions on Query
      @refetchable(queryName: "ModelSchemaTableDimensionsQuery")
      @argumentDefinitions(
        count: { type: "Int", defaultValue: 50 }
        cursor: { type: "String", defaultValue: null }
      ) {
        model {
          dimensions(first: $count, after: $cursor)
            @connection(key: "ModelSchemaTable_dimensions") {
            edges {
              dimension: node {
                name
                type
                dataType
                dataQuality {
                  cardinality
                }
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
      data.model.dimensions.edges.map(({ dimension }) => {
        // Normalize the data
        return {
          ...dimension,
          cardinality: dimension.dataQuality.cardinality,
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
      {
        Header: "Type",
        accessor: "type",
      },
      {
        Header: "Data Type",
        accessor: "dataType",
      },
      {
        Header: "Cardinality",
        accessor: "cardinality",
      },
    ];
    return cols;
  }, []);

  // Render the UI for your table
  return <Table columns={columns} data={tableData} />;
}
