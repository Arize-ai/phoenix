import React, { startTransition, useMemo } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Flex, Icon, Icons } from "@arizeai/components";

import { TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";

import { SystemAPIKeysTableFragment$key } from "./__generated__/SystemAPIKeysTableFragment.graphql";
import { SystemAPIKeysTableQuery } from "./__generated__/SystemAPIKeysTableQuery.graphql";
import { DeleteSystemAPIKeyButton } from "./DeleteSystemAPIKeyButton";

export function SystemAPIKeysTable({
  query,
}: {
  query: SystemAPIKeysTableFragment$key;
}) {
  const [data, refetch] = useRefetchableFragment<
    SystemAPIKeysTableQuery,
    SystemAPIKeysTableFragment$key
  >(
    graphql`
      fragment SystemAPIKeysTableFragment on Query
      @refetchable(queryName: "SystemAPIKeysTableQuery") {
        systemApiKeys {
          id
          name
          description
          createdAt
          expiresAt
        }
      }
    `,
    query
  );

  const tableData = useMemo(() => {
    return [...data.systemApiKeys];
  }, [data]);

  type TableRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
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
        header: "Created At",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "Expires At",
        accessorKey: "expiresAt",
        cell: TimestampCell,
      },
      {
        header: "",
        accessorKey: "id",
        size: 10,
        cell: ({ row }) => {
          return (
            <Flex direction="row" justifyContent="end" width="100%">
              <DeleteSystemAPIKeyButton
                id={row.original.id}
                onDeleted={() => {
                  startTransition(() => {
                    refetch(
                      {},
                      {
                        fetchPolicy: "network-only",
                      }
                    );
                  });
                }}
              />
            </Flex>
          );
        },
        meta: {
          textAlign: "right",
        },
      },
    ];
    return cols;
  }, [refetch]);
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = table.getRowModel().rows.length === 0;
  return (
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
        <TableEmpty message="No Keys" />
      ) : (
        <tbody>
          {rows.map((row) => {
            return (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      )}
    </table>
  );
}
