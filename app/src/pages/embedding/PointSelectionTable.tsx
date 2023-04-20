import React, { useMemo } from "react";
import {
  CellProps,
  Column,
  useFlexLayout,
  useResizeColumns,
  useTable,
} from "react-table";

import { ExternalLink, LinkButton } from "@phoenix/components";
import { TextCell } from "@phoenix/components/table";
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
      hasRawData = false,
      hasPromptAndResponse = false;
    data.forEach((point) => {
      if (point.linkToData) {
        hasLinkToData = true;
      }
      if (point.rawData) {
        hasRawData = true;
      }
      if (point.prompt || point.response) {
        hasPromptAndResponse = true;
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
    if (hasPromptAndResponse) {
      dataDrivenColumns.push({
        Header: "Prompt",
        accessor: "prompt",
        width: 300,
        Cell: TextCell,
      });
      dataDrivenColumns.push({
        Header: "Response",
        accessor: "response",
        width: 300,
        Cell: TextCell,
      });
    } else if (hasRawData) {
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
        resizable: false,
        width: 50,
      },
      {
        Header: "Actual Label",
        accessor: "actualLabel",
        resizable: false,
        width: 50,
      },
      {
        Header: "",
        accessor: "id",
        resizable: false,
        width: 50,
        Cell: ({ value }: CellProps<ModelEvent>) => {
          return (
            <LinkButton
              aria-label="view point details"
              onClick={() => {
                onPointSelected(value);
              }}
            >
              view details
            </LinkButton>
          );
        },
      },
    ];
  }, [data, onPointSelected]);

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, rows } =
    useTable<ModelEvent>(
      {
        columns,
        data,
      },
      useFlexLayout,
      useResizeColumns
    );

  return (
    <table {...getTableProps()} css={tableCSS}>
      <thead>
        {headerGroups.map((headerGroup, idx) => (
          <tr {...headerGroup.getHeaderGroupProps()} key={idx}>
            {headerGroup.headers.map((column, idx) => (
              <th {...column.getHeaderProps()} key={idx}>
                {column.render("Header")}
                {/* Use column.getResizerProps to hook up the events correctly */}
                {column.canResize && (
                  <div
                    {...column.getResizerProps()}
                    className={`resizer ${
                      column.isResizing ? "isResizing" : ""
                    }`}
                  />
                )}
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
