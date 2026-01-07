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
import { DeletePromptLabelButton } from "@phoenix/pages/settings/prompts/DeletePromptLabelButton";

import { PromptLabelsTableFragment$key } from "./__generated__/PromptLabelsTableFragment.graphql";

export function PromptLabelsTable({
  query,
}: {
  query: PromptLabelsTableFragment$key;
}) {
  "use no memo";
  const data = useFragment<PromptLabelsTableFragment$key>(
    graphql`
      fragment PromptLabelsTableFragment on Query
      @argumentDefinitions(first: { type: "Int", defaultValue: 100 }) {
        promptLabels(first: $first)
          @connection(key: "PromptLabelsTable__promptLabels") {
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
    () => data.promptLabels.edges.map((edge) => edge.node),
    [data]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<(typeof tableData)[number]>({
    columns: [
      {
        header: "label",
        accessorKey: "name",
        cell: ({ row }) => {
          return (
            <Token color={row.original.color ?? undefined}>
              {row.original.name}
            </Token>
          );
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
              <DeletePromptLabelButton promptLabelId={row.original.id} />
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
