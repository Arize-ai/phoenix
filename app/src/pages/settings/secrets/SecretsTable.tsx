import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Card, Flex, Icon, Icons, Text } from "@phoenix/components";
import { TableEmpty } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { UserPicture } from "@phoenix/components/user/UserPicture";

import type { SettingsSecretsPageFragment$data } from "./__generated__/SettingsSecretsPageFragment.graphql";
import { DeleteSecretButton } from "./DeleteSecretButton";
import { NewSecretButton } from "./NewSecretButton";
import { ReplaceSecretButton } from "./ReplaceSecretButton";

type SecretRow =
  SettingsSecretsPageFragment$data["secrets"]["edges"][number]["node"];

export function SecretsTable({
  data,
  authenticationEnabled,
  search,
  connectionId,
}: {
  data: SecretRow[];
  authenticationEnabled: boolean;
  search: string;
  connectionId: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  const columns = useMemo<ColumnDef<SecretRow>[]>(() => {
    const cols: ColumnDef<SecretRow>[] = [
      {
        header: "Key",
        accessorKey: "key",
      },
      {
        header: "Updated At",
        accessorKey: "updatedAt",
        cell: TimestampCell,
      },
    ];

    if (authenticationEnabled) {
      cols.push({
        header: "Created By",
        id: "user",
        accessorFn: (row) => row.user?.username ?? "",
        cell: ({ row }) => {
          const user = row.original.user;
          if (!user) {
            return <Text color="text-700">System</Text>;
          }
          return (
            <Flex direction="row" gap="size-50" alignItems="center">
              <UserPicture
                name={user.username}
                profilePictureUrl={user.profilePictureUrl ?? null}
                size={20}
              />
              <span>{user.username}</span>
            </Flex>
          );
        },
      });
    }

    cols.push({
      id: "actions",
      cell: ({ row }) => {
        return (
          <Flex direction="row" gap="size-50" width="100%" justifyContent="end">
            <ReplaceSecretButton
              secretKey={row.original.key}
              connectionId={connectionId}
            />
            <DeleteSecretButton
              secretKey={row.original.key}
              connectionId={connectionId}
            />
          </Flex>
        );
      },
      meta: {
        textAlign: "right",
      },
    });

    return cols;
  }, [authenticationEnabled, connectionId]);

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<SecretRow>({
    columns,
    data,
    state: {
      globalFilter: search,
      sorting,
    },
    globalFilterFn: (row, _, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [row.original.key, row.original.user?.username ?? ""].some(
        (value) => value.toLowerCase().includes(query)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <Card
      title="Secrets"
      extra={<NewSecretButton connectionId={connectionId} />}
    >
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
          <TableEmpty message="No Secrets" />
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
