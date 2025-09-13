import { graphql, useFragment } from "react-relay";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Button, Card, Flex, Icon, Icons, Token } from "@phoenix/components";
import { TableEmpty } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";

import { PromptLabelsSettingsCardFragment$key } from "./__generated__/PromptLabelsSettingsCardFragment.graphql";

export function PromptLabelsSettingsCard({
  query,
}: {
  query: PromptLabelsSettingsCardFragment$key;
}) {
  const data = useFragment<PromptLabelsSettingsCardFragment$key>(
    graphql`
      fragment PromptLabelsSettingsCardFragment on Query {
        promptLabels {
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
  const tableData = data.promptLabels.edges.map((edge) => edge.node);

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
        cell: () => {
          return (
            <Flex width="100%" alignItems="end" justifyContent="end">
              <Button
                size="S"
                leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
                variant="danger"
              />
            </Flex>
          );
        },
      },
    ],
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
    <Card
      title="Prompt Labels"
      extra={
        <Button
          size="S"
          variant="primary"
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        >
          New Label
        </Button>
      }
    >
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
    </Card>
  );
}
