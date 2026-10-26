import { flexRender, useTable } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { Card, Flex, Icon, Icons, Link } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";

export type VersionTagsConfigRow = {
  id: string;
  name: string;
  description?: string | null;
  versionId: string;
};

/**
 * The "Tags" card of a prompt or decision config page: each version tag,
 * the version it points at, and a delete control.
 */
export function VersionTagsConfigTable({
  ownerId,
  tags,
  renderDeleteButton,
}: {
  /**
   * The id of the prompt or decision that owns the tags
   */
  ownerId: string;
  tags: readonly VersionTagsConfigRow[];
  renderDeleteButton: (tag: VersionTagsConfigRow) => ReactNode;
}) {
  const tableData = useMemo(
    () =>
      tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        versionId: tag.versionId,
      })),
    [tags]
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
        accessorKey: "versionId",
        cell: ({ row }) => (
          <Link to={`/prompts/${ownerId}/versions/${row.original.versionId}`}>
            <Truncate maxWidth="100%">{row.original.versionId}</Truncate>
          </Link>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 5,
        accessorKey: "id",
        cell: ({ row }) => (
          <Flex
            direction="row"
            gap="size-100"
            justifyContent="end"
            width="100%"
            // We set the key here because aria-components will keep the dialog open on the row that replaces it after delete
            key={row.original.id}
          >
            {renderDeleteButton(row.original)}
          </Flex>
        ),
      },
    ],
    [ownerId, renderDeleteButton]
  );

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: tableData,
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  return (
    <Card title="Tags">
      <table css={tableCSS}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th colSpan={header.colSpan} key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div
                      {...{
                        className: header.column.getCanSort() ? "sort" : "",
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
                              <Icons.CaretUpFilled />
                            ) : (
                              <Icons.CaretDownFilled />
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
