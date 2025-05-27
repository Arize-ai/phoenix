import { startTransition, useCallback, useMemo } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Flex, Icon, Icons } from "@phoenix/components";
import { DeleteAPIKeyButton } from "@phoenix/components/auth";
import { TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { UserAPIKeysTableFragment$key } from "./__generated__/UserAPIKeysTableFragment.graphql";
import { UserAPIKeysTableQuery } from "./__generated__/UserAPIKeysTableQuery.graphql";

const TIMESTAMP_CELL_SIZE = 70;

export function UserAPIKeysTable({
  query,
}: {
  query: UserAPIKeysTableFragment$key;
}) {
  const [data, refetch] = useRefetchableFragment<
    UserAPIKeysTableQuery,
    UserAPIKeysTableFragment$key
  >(
    graphql`
      fragment UserAPIKeysTableFragment on Query
      @refetchable(queryName: "UserAPIKeysTableQuery") {
        userApiKeys {
          id
          name
          description
          createdAt
          expiresAt
          user {
            email
          }
        }
      }
    `,
    query
  );

  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();
  const [commit] = useMutation(graphql`
    mutation UserAPIKeysTableDeleteAPIKeyMutation($input: DeleteApiKeyInput!) {
      deleteUserApiKey(input: $input) {
        __typename
        apiKeyId
      }
    }
  `);
  const handleDelete = useCallback(
    (id: string) => {
      commit({
        variables: {
          input: {
            id,
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "User key deleted",
            message: "The user key has been deleted and is no longer active.",
          });
          startTransition(() => {
            refetch(
              {},
              {
                fetchPolicy: "network-only",
              }
            );
          });
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "Error deleting user key",
            message: formattedError?.[0] ?? error.message,
          });
        },
      });
    },
    [commit, notifyError, notifySuccess, refetch]
  );

  const tableData = useMemo(() => {
    return [...data.userApiKeys];
  }, [data]);

  type TableRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "Name",
        accessorKey: "name",
        size: 100,
        cell: TextCell,
      },
      {
        header: "Description",
        accessorKey: "description",
        cell: TextCell,
      },
      {
        header: "Created At",
        accessorKey: "createdAt",
        size: TIMESTAMP_CELL_SIZE,
        cell: TimestampCell,
      },
      {
        header: "Expires At",
        accessorKey: "expiresAt",
        size: TIMESTAMP_CELL_SIZE,
        cell: TimestampCell,
      },
      {
        header: "User",
        size: 120,
        accessorKey: "user.email",
        cell: TextCell,
      },
      {
        header: "",
        accessorKey: "id",
        size: 10,
        cell: ({ row }) => {
          return (
            <Flex direction="row" justifyContent="end" width="100%">
              <DeleteAPIKeyButton
                handleDelete={() => {
                  handleDelete(row.original.id);
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
  }, [handleDelete]);
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
