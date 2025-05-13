import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Card } from "@arizeai/components";

import { Flex, Icon, Icons, Link } from "@phoenix/components";
import { TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";

import { PromptVersionTagsConfigCard_data$key } from "./__generated__/PromptVersionTagsConfigCard_data.graphql";
import { DeletePromptVersionTagButton } from "./DeletePromptVersionTagButton";

export function PromptVersionTagsConfigCard({
  prompt,
}: {
  prompt: PromptVersionTagsConfigCard_data$key;
}) {
  const data = useFragment(
    graphql`
      fragment PromptVersionTagsConfigCard_data on Prompt {
        id
        versionTags {
          id
          name
          description
          promptVersionId
        }
      }
    `,
    prompt
  );

  const columns = useMemo(
    (): ColumnDef<(typeof tableData)[number]>[] => [
      {
        header: "Name",
        accessorKey: "name",
      },
      {
        header: "Description",
        accessorKey: "description",
        cell: TextCell,
      },
      {
        header: "Version",
        accessorKey: "promptVersionId",
        cell: ({ row }) => {
          const { promptId, promptVersionId } = row.original;
          return (
            <Link to={`/prompts/${promptId}/versions/${promptVersionId}`}>
              {row.original.promptVersionId}
            </Link>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 5,
        accessorKey: "id",
        cell: ({ row }) => {
          return (
            <Flex
              direction="row"
              gap="size-100"
              justifyContent="end"
              width="100%"
            >
              <DeletePromptVersionTagButton
                promptVersionTagId={row.original.id}
                promptId={row.original.promptId}
                // We set the key here because aria-components will keep the dialog open on the row that replaces it after delete
                key={row.original.id}
              />
            </Flex>
          );
        },
      },
    ],
    []
  );

  const tableData = useMemo(() => {
    return data.versionTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      description: tag.description,
      promptId: data.id,
      promptVersionId: tag.promptVersionId,
    }));
  }, [data]);

  const table = useReactTable<(typeof tableData)[number]>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  return (
    <Card title="Tags" variant="compact" bodyStyle={{ padding: 0 }}>
      <table css={tableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div
                      {...{
                        className: header.column.getCanSort()
                          ? "cursor-pointer"
                          : "",
                        onClick: header.column.getToggleSortingHandler(),
                        style: {
                          left: header.getStart(),
                          width: header.getSize(),
                        },
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() ? (
                        <Icon
                          className="sort-icon"
                          svg={
                            header.column.getIsSorted() === "asc" ? (
                              <Icons.ArrowUpFilled />
                            ) : (
                              <Icons.ArrowDownFilled />
                            )
                          }
                        />
                      ) : null}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        {isEmpty ? (
          <TableEmpty message="No Tags" />
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </Card>
  );
}
