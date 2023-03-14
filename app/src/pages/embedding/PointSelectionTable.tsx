import React, { useMemo } from "react";
import { CellProps, Column, useTable } from "react-table";

import { Button } from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";

import { ModelEvent } from "./types";

/**
 * Lists the points that have been selected in the point cloud
 */
export function PointSelectionTable({
  data,
  onPointSelected,
}: {
  data: ModelEvent[];
  onPointSelected: (pointId: string) => void;
}) {
  const columns: Column<ModelEvent>[] = useMemo(() => {
    let hasLinkToData = false,
      hasRawData = false;
    data.forEach((point) => {
      if (point.linkToData) {
        hasLinkToData = true;
      }
      if (point.rawData) {
        hasRawData = true;
      }
    });
    // Columns that are only visible if certain data is available
    const dataDrivenColumns: Column<ModelEvent>[] = [];
    if (hasLinkToData) {
      dataDrivenColumns.push({
        Header: "Link",
        accessor: "linkToData",
        Cell: ({ value }: CellProps<ModelEvent>) => {
          if (typeof value === "string") {
            const fileName = value.split("/").pop();
            return <ExternalLink href={value}>{fileName}</ExternalLink>;
          }
          return null;
        },
      });
    }
    if (hasRawData) {
      dataDrivenColumns.push({
        Header: "Raw Data",
        accessor: "rawData",
        width: 300,
      });
    }
    return [
      ...dataDrivenColumns,
      {
        Header: "Prediction Label",
        accessor: "predictionLabel",
      },
      {
        Header: "Actual Label",
        accessor: "actualLabel",
      },
      {
        Header: "",
        accessor: "id",
        Cell: ({ value }: CellProps<ModelEvent>) => {
          return (
            <Button
              variant="default"
              size="compact"
              aria-label="view point details"
              onClick={() => {
                onPointSelected(value);
              }}
            >
              view details
            </Button>
          );
        },
      },
    ];
  }, [data, onPointSelected]);

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, rows } =
    useTable<ModelEvent>({
      columns,
      data,
    });

  return (
    <table {...getTableProps()} css={tableCSS}>
      <thead>
        {headerGroups.map((headerGroup, idx) => (
          <tr {...headerGroup.getHeaderGroupProps()} key={idx}>
            {headerGroup.headers.map((column, idx) => (
              <th {...column.getHeaderProps()} key={idx}>
                {column.render("Header")}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, idx) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()} key={idx}>
              {row.cells.map((cell, idx) => {
                return (
                  <td {...cell.getCellProps()} key={idx}>
                    {cell.render("Cell")}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
