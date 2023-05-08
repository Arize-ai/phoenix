import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { CellProps, Column } from "react-table";

import {
  FloatCell,
  IntCell,
  PercentCell,
  Table,
} from "@phoenix/components/table";

import { Link } from "../Link";

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
        startTime: { type: "DateTime!" }
        endTime: { type: "DateTime!" }
      ) {
        model {
          dimensions(first: $count, after: $cursor)
            @connection(key: "ModelSchemaTable_dimensions") {
            edges {
              dimension: node {
                id
                name
                type
                dataType
                cardinality: dataQualityMetric(
                  metric: cardinality
                  timeRange: { start: $startTime, end: $endTime }
                )
                percentEmpty: dataQualityMetric(
                  metric: percentEmpty
                  timeRange: { start: $startTime, end: $endTime }
                )
                min: dataQualityMetric(
                  metric: min
                  timeRange: { start: $startTime, end: $endTime }
                )
                mean: dataQualityMetric(
                  metric: mean
                  timeRange: { start: $startTime, end: $endTime }
                )
                max: dataQualityMetric(
                  metric: max
                  timeRange: { start: $startTime, end: $endTime }
                )
                psi: driftMetric(
                  metric: psi
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
    const cols: Column<(typeof tableData)[number]>[] = [
      {
        Header: "name",
        accessor: "name",
        Cell: (props: CellProps<(typeof tableData)[number]>) => {
          return (
            <Link to={`/dimensions/${props.row.original.id}`}>
              {props.value}
            </Link>
          );
        },
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
        Cell: IntCell,
      },
      {
        Header: "% empty",
        accessor: "percentEmpty",
        Cell: PercentCell,
      },
      {
        Header: "min",
        accessor: "min",
        Cell: FloatCell,
      },
      {
        Header: "mean",
        accessor: "mean",
        Cell: FloatCell,
      },
      {
        Header: "max",
        accessor: "max",
        Cell: FloatCell,
      },
      {
        Header: "PSI",
        accessor: "psi",
        Cell: FloatCell,
      },
    ];
    return cols;
  }, []);

  // Render the UI for your table
  return <Table columns={columns} data={tableData} />;
}
