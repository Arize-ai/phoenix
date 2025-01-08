import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Card } from "@arizeai/components";

import { Icon, Icons } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";

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
      },
      {
        id: "actions",
        header: "",
        size: 10,
        accessorKey: "id",
        cell: ({ row }) => {
          return (
            <DeletePromptVersionTagButton
              promptVersionTagId={row.original.id}
              promptId={row.original.promptId}
            />
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
    }));
  }, [data]);

  const table = useReactTable<(typeof tableData)[number]>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
