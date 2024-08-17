import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Icon, Icons } from "@arizeai/components";

import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";

import { UsersTableQuery } from "./__generated__/UsersTableQuery.graphql";

export function UsersTable() {
  const data = useLazyLoadQuery<UsersTableQuery>(
    graphql`
      query UsersTableQuery {
        users {
          edges {
            user: node {
              email
              username
              createdAt
              role {
                name
              }
            }
          }
        }
      }
    `,
    {}
  );

  const tableData = useMemo(() => {
    return data.users.edges.map(({ user }) => ({
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
      roleName: user.role.name,
    }));
  }, [data]);

  type TableRow = (typeof tableData)[number];
  const table = useReactTable<TableRow>({
    columns: [
      {
        header: "email",
        accessorKey: "email",
      },
      {
        header: "username",
        accessorKey: "username",
      },
      {
        header: "role",
        accessorKey: "roleName",
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
    ],
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
        <TableEmpty />
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
