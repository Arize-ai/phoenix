import React, { useMemo } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { selectableTableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TextCell } from "@phoenix/components/table/TextCell";

import type { DatasetExamplesTableFragment$key } from "./__generated__/DatasetExamplesTableFragment.graphql";
import type {
  datasetLoaderQuery,
  datasetLoaderQuery$data,
} from "./__generated__/datasetLoaderQuery.graphql";

export function DatasetExamplesTable({
  dataset,
}: {
  dataset: datasetLoaderQuery$data["dataset"];
}) {
  const [data] = useRefetchableFragment<
    datasetLoaderQuery,
    DatasetExamplesTableFragment$key
  >(
    graphql`
      fragment DatasetExamplesTableFragment on Dataset
      @refetchable(queryName: "DatasetExamplesTableQuery") {
        examples {
          edges {
            node {
              id
              input
              output
              metadata
            }
          }
        }
      }
    `,
    dataset
  );
  const tableData = useMemo(
    () =>
      data.examples.edges.map((edge) => {
        const { id, input, output, metadata } = edge.node;
        return {
          id,
          input: JSON.stringify(input),
          output: JSON.stringify(output),
          metadata: JSON.stringify(metadata),
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "id",
      accessorKey: "id",
      cell: TextCell,
    },
    {
      header: "input",
      accessorKey: "input",
      cell: TextCell,
    },
    {
      header: "output",
      accessorKey: "output",
      cell: TextCell,
    },
    {
      header: "metadata",
      accessorKey: "metadata",
      cell: TextCell,
    },
  ];
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <table css={selectableTableCSS}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                <div>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </div>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      {isEmpty ? (
        <TableEmpty />
      ) : (
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => {
                return (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      )}
    </table>
  );
}
