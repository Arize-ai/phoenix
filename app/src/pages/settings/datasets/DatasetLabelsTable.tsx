import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Flex, Token } from "@phoenix/components";
import { TableEmpty } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";

import { DatasetLabelsTableFragment$key } from "./__generated__/DatasetLabelsTableFragment.graphql";
import { DeleteDatasetLabelButton } from "./DeleteDatasetLabelButton";

export function DatasetLabelsTable({
  query,
}: {
  query: DatasetLabelsTableFragment$key;
}) {
  const data = useFragment<DatasetLabelsTableFragment$key>(
    graphql`
      fragment DatasetLabelsTableFragment on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 100 }) {
        datasetLabels(first: $first)
          @connection(key: "DatasetLabelsTable__datasetLabels") {
          edges {
            node {
              id
              name
              description
              color
            }
          }
        }
      }
    `,
    query
  );
  const tableData = useMemo(
    () => data.datasetLabels.edges.map((edge) => edge.node),
    [data.datasetLabels.edges]
  );

  const table = useReactTable<(typeof tableData)[number]>({
    columns: [
      {
        header: "label",
        accessorKey: "name",
        cell: ({ row }) => {
          return <Token color={row.original.color}>{row.original.name}</Token>;
        },
      },
      {
        header: "description",
        accessorKey: "description",
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => {
          return (
            <Flex width="100%" alignItems="end" justifyContent="end">
              <DeleteDatasetLabelButton datasetLabelId={row.original.id} />
            </Flex>
          );
        },
      },
    ],
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const hasContent = rows.length > 0;
  const body = hasContent ? (
    <tbody>
      {rows.map((row) => {
        return (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => {
              return (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  ) : (
    <TableEmpty />
  );
  return (
    <table css={tableCSS}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th colSpan={header.colSpan} key={header.id}>
                {header.isPlaceholder ? null : (
                  <div>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </div>
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      {body}
    </table>
  );
}
