/* eslint-disable react/prop-types */
import React, { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { ColumnDef } from "@tanstack/react-table";

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
  type TableDataType = (typeof tableData)[number];
  const columns = React.useMemo<ColumnDef<TableDataType>[]>(() => {
    const cols: ColumnDef<TableDataType>[] = [
      {
        header: "name",
        accessorKey: "name",
        cell: (props) => {
          return (
            <Link to={`dimensions/${props.row.original.id}`}>
              {props.renderValue() as string}
            </Link>
          );
        },
      },
      {
        header: "type",
        accessorKey: "type",
      },
      {
        header: "data type",
        accessorKey: "dataType",
      },
      {
        header: "cardinality",
        accessorKey: "cardinality",
        cell: IntCell,
      },
      {
        header: "% empty",
        accessorKey: "percentEmpty",
        cell: PercentCell,
      },
      {
        header: "min",
        accessorKey: "min",
        cell: FloatCell,
      },
      {
        header: "mean",
        accessorKey: "mean",
        cell: FloatCell,
      },
      {
        header: "max",
        accessorKey: "max",
        cell: FloatCell,
      },
      {
        header: "PSI",
        accessorKey: "psi",
        cell: FloatCell,
      },
    ];
    return cols;
  }, []);

  // Render the UI for your table
  return <Table columns={columns} data={tableData} />;
}
