import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { Column } from "react-table";

import { Table } from "@phoenix/components/table";

import { ModelSchemaTable_dimensions$key } from "./__generated__/ModelSchemaTable_dimensions.graphql";

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
                cardinality: dataQualityMetric(metric: cardinality)
                percentEmpty: dataQualityMetric(metric: percentEmpty)
                min: dataQualityMetric(metric: min)
                mean: dataQualityMetric(metric: mean)
                max: dataQualityMetric(metric: max)
                psi: driftMetric(metric: psi)
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
        };
      }),
    [data]
  );

  // Declare the columns
  const columns = React.useMemo(() => {
    const cols: Column<typeof tableData[number]>[] = [
      {
        Header: "name",
        accessor: "name",
      },
      {
        Header: "type",
        accessor: "type",
      },
      {
        Header: "data type",
        accessor: "dataType",
      },
      {
        Header: "cardinality",
        accessor: "cardinality",
      },
      {
        Header: "% empty",
        accessor: "percentEmpty",
      },
      {
        Header: "min",
        accessor: "min",
      },
      {
        Header: "mean",
        accessor: "mean",
      },
      {
        Header: "max",
        accessor: "max",
      },
      {
        Header: "psi",
        accessor: "psi",
      },
    ];
    return cols;
  }, []);

  // Render the UI for your table
  return <Table columns={columns} data={tableData} />;
}
