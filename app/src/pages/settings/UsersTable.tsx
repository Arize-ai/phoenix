import {
  ReactNode,
  startTransition,
  useCallback,
  useMemo,
  useState,
} from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { DialogContainer } from "@arizeai/components";

import { Flex, Icon, Icons } from "@phoenix/components";
import { RolePicker } from "@phoenix/components/settings/RolePicker";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { isUserRole, normalizeUserRole } from "@phoenix/constants";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import { UsersTable_users$key } from "./__generated__/UsersTable_users.graphql";
import { UsersTableQuery } from "./__generated__/UsersTableQuery.graphql";
import { UserActionMenu } from "./UserActionMenu";
import { UserRoleChangeDialog } from "./UserRoleChangeDialog";

const USER_TABLE_ROW_HEIGHT = 55;

const emailLinkCSS = css`
  text-decoration: none;
  color: var(--ac-global-color-grey-600);
  font-size: 12px;
  &:hover {
    text-decoration: underline;
  }
`;

/**
 * Rows may render different content depending on the user so we normalize the height
 */
const userTableRowCSS = css`
  height: ${USER_TABLE_ROW_HEIGHT}px;
`;

const isDefaultAdminUser = (user: { email: string; username: string }) =>
  user.email === "admin@localhost" || user.username === "admin";

export function UsersTable({ query }: { query: UsersTable_users$key }) {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const [data, refetch] = useRefetchableFragment<
    UsersTableQuery,
    UsersTable_users$key
  >(
    graphql`
      fragment UsersTable_users on Query
      @refetchable(queryName: "UsersTableQuery") {
        users {
          edges {
            user: node {
              id
              email
              username
              createdAt
              authMethod
              profilePictureUrl
              role {
                name
              }
            }
          }
        }
      }
    `,
    query
  );

  const tableData = useMemo(() => {
    return data.users.edges.map(({ user }) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      profilePictureUrl: user.profilePictureUrl,
      createdAt: user.createdAt,
      role: user.role.name,
      authMethod: user.authMethod,
    }));
  }, [data]);

  const refetchTableData = useCallback(() => {
    startTransition(() => {
      refetch({}, { fetchPolicy: "network-only" });
    });
  }, [refetch]);
  const { viewer } = useViewer();
  type TableRow = (typeof tableData)[number];
  const columns = useMemo((): ColumnDef<TableRow>[] => {
    return [
      {
        header: "user",
        accessorKey: "username",
        cell: ({ row }) => (
          <Flex direction="row" gap="size-50" alignItems="center">
            <UserPicture
              name={row.original.username}
              profilePictureUrl={row.original.profilePictureUrl}
              size={20}
            />
            <span>{row.original.username}</span>
            <a href={`mailto:${row.original.email}`} css={emailLinkCSS}>
              {row.original.email}
            </a>
          </Flex>
        ),
      },
      {
        header: "method",
        accessorKey: "authMethod",
        size: 10,
        cell: ({ row }) => row.original.authMethod.toLowerCase(),
      },
      {
        header: "role",
        accessorKey: "role",
        cell: ({ row }) => {
          if (
            isDefaultAdminUser(row.original) ||
            (viewer && viewer.email == row.original.email)
          ) {
            return normalizeUserRole(row.original.role);
          }
          return (
            <RolePicker
              includeLabel={false}
              onChange={(key) => {
                if (key === row.original.role) {
                  return;
                }
                setDialog(
                  <UserRoleChangeDialog
                    onClose={() => setDialog(null)}
                    onRoleChanged={refetchTableData}
                    currentRole={row.original.role}
                    newRole={key}
                    email={row.original.email}
                    userId={row.original.id}
                  />
                );
              }}
              role={
                isUserRole(row.original.role) ? row.original.role : undefined
              }
            />
          );
        },
      },
      {
        header: "created at",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "",
        accessorKey: "id",
        size: 10,
        cell: ({ row }) => {
          if (isDefaultAdminUser(row.original)) {
            return null;
          }
          return (
            <Flex direction="row" justifyContent="end" width="100%">
              <UserActionMenu
                userId={row.original.id}
                onUserDeleted={refetchTableData}
                authMethod={row.original.authMethod}
              />
            </Flex>
          );
        },
        meta: {
          textAlign: "right",
        },
      },
    ];
  }, [refetchTableData, viewer]);

  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
              <tr key={row.id} css={userTableRowCSS}>
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
      <DialogContainer
        onDismiss={() => setDialog(null)}
        isDismissable
        type="modal"
      >
        {dialog}
      </DialogContainer>
    </table>
  );
}
