import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { ConnectionHandler, graphql, usePaginationFragment } from "react-relay";
import { useNavigate, useParams } from "react-router";

import {
  Flex,
  Icon,
  Icons,
  Link,
  Modal,
  ModalOverlay,
} from "@phoenix/components";
import { Counter } from "@phoenix/components/core/counter";
import { RoleSelect } from "@phoenix/components/settings/RoleSelect";
import { LoadMoreRow } from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  selectableTableCSS,
} from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { isUserRole, normalizeUserRole } from "@phoenix/constants";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import type { UsersTable_users$key } from "./__generated__/UsersTable_users.graphql";
import type { UsersTableQuery } from "./__generated__/UsersTableQuery.graphql";
import { UserActionMenu } from "./UserActionMenu";
import { UserRoleChangeDialog } from "./UserRoleChangeDialog";

const USER_TABLE_ROW_HEIGHT = 55;
const PAGE_SIZE = 50;

const emailLinkCSS = css`
  text-decoration: none;
  color: var(--global-color-gray-600);
  font-size: 12px;
  &:hover {
    text-decoration: underline;
  }
`;

/**
 * Make the headers sticky so they are always visible when scrolling
 */
const usersTableHeaderCSS = css`
  position: sticky;
  top: 0;
  z-index: 2;
  white-space: nowrap;
`;

/**
 * Rows may render different content depending on the user so we normalize the height
 */
const userTableRowCSS = css`
  height: ${USER_TABLE_ROW_HEIGHT}px;
`;

/**
 * Container for the users table with scrolling
 */
const usersTableContainerCSS = css`
  overflow: auto;
  max-height: var(--global-dimension-size-6000);
`;

const isDefaultAdminUser = (user: { email: string | null; username: string }) =>
  user.email === "admin@localhost" || user.username === "admin";

export function UsersTable({ query }: { query: UsersTable_users$key }) {
  "use no memo";
  const [dialog, setDialog] = useState<ReactNode>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    UsersTableQuery,
    UsersTable_users$key
  >(
    graphql`
      fragment UsersTable_users on Query
      @refetchable(queryName: "UsersTableQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 50 }
      ) {
        users(first: $first, after: $after)
          @connection(key: "UsersTable_users") {
          edges {
            user: node {
              id
              email
              username
              createdAt
              authMethod
              profilePictureUrl
              apiKeyCount
              oauth2GrantCount
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
      apiKeyCount: user.apiKeyCount,
      oauth2GrantCount: user.oauth2GrantCount,
    }));
  }, [data]);

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isLoadingNext &&
          hasNext
        ) {
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );
  const { viewer } = useViewer();
  const navigate = useNavigate();
  const { userId: selectedUserId } = useParams();
  type TableRow = (typeof tableData)[number];
  const columns = useMemo((): ColumnDef<TableRow>[] => {
    return [
      {
        header: "user",
        accessorKey: "username",
        size: 300,
        cell: ({ row }) => {
          return (
            <Flex direction="row" gap="size-50" alignItems="center">
              <UserPicture
                name={row.original.username}
                profilePictureUrl={row.original.profilePictureUrl}
                size={20}
              />
              <Link to={`/settings/users/${row.original.id}`}>
                {row.original.username}
              </Link>
              {row.original.email && (
                <a
                  href={`mailto:${row.original.email}`}
                  css={emailLinkCSS}
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.original.email}
                </a>
              )}
            </Flex>
          );
        },
      },
      {
        header: "API keys",
        accessorKey: "apiKeyCount",
        size: 100,
        meta: {
          textAlign: "right",
        },
        cell: ({ row }) => (
          <Counter variant="quiet">{row.original.apiKeyCount}</Counter>
        ),
      },
      {
        header: "Authorized applications",
        accessorKey: "oauth2GrantCount",
        size: 190,
        meta: {
          textAlign: "right",
        },
        cell: ({ row }) => (
          <Counter variant="quiet">{row.original.oauth2GrantCount}</Counter>
        ),
      },
      {
        header: "authentication",
        accessorKey: "authMethod",
        size: 140,
        cell: ({ row }) => row.original.authMethod.toLowerCase(),
      },
      {
        header: "role",
        accessorKey: "role",
        size: 160,
        cell: ({ row }) => {
          if (
            isDefaultAdminUser(row.original) ||
            (viewer && viewer.id === row.original.id)
          ) {
            return normalizeUserRole(row.original.role);
          }
          return (
            <RoleSelect
              includeLabel={false}
              size="S"
              onChange={(key) => {
                if (!isUserRole(key) || key === row.original.role) {
                  return;
                }
                setDialog(
                  <UserRoleChangeDialog
                    onClose={() => setDialog(null)}
                    currentRole={row.original.role}
                    newRole={key}
                    username={row.original.username}
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
        size: 220,
        cell: TimestampCell,
      },
      {
        id: "actions",
        header: "",
        accessorKey: "id",
        size: 56,
        cell: ({ row }) => {
          if (isDefaultAdminUser(row.original)) {
            return null;
          }
          return (
            <Flex direction="row" justifyContent="end" width="100%">
              <UserActionMenu
                userId={row.original.id}
                connectionIds={[
                  ConnectionHandler.getConnectionID(
                    "client:root",
                    "UsersTable_users"
                  ),
                ]}
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
  }, [viewer]);

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    state: {
      columnPinning: {
        right: ["actions"],
      },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = table.getRowModel().rows.length === 0;
  return (
    <div
      css={usersTableContainerCSS}
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.currentTarget)}
    >
      <table
        css={selectableTableCSS}
        style={{ width: table.getTotalSize(), minWidth: "100%" }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortDir = header.column.getIsSorted();
                return (
                  <th
                    colSpan={header.colSpan}
                    key={header.id}
                    css={usersTableHeaderCSS}
                    aria-sort={
                      sortDir === "asc"
                        ? "ascending"
                        : sortDir === "desc"
                          ? "descending"
                          : header.column.getCanSort()
                            ? "none"
                            : undefined
                    }
                    style={{
                      width: header.column.getSize(),
                      minWidth: header.column.getSize(),
                      maxWidth: header.column.getSize(),
                      ...(header.column.getIsPinned()
                        ? getCommonPinningStyles(header.column)
                        : {}),
                      zIndex: header.column.getIsPinned() ? 3 : undefined,
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        {...{
                          className: header.column.getCanSort() ? "sort" : "",
                          onClick: header.column.getToggleSortingHandler(),
                          style: {
                            textAlign: header.column.columnDef.meta?.textAlign,
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
                );
              })}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmpty />
        ) : (
          <tbody>
            {rows.map((row) => {
              const isSelected = row.original.id === selectedUserId;
              return (
                <tr
                  key={row.id}
                  css={userTableRowCSS}
                  data-selected={isSelected}
                  onClick={() => navigate(`/settings/users/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <td
                        key={cell.id}
                        align={cell.column.columnDef.meta?.textAlign}
                        style={
                          cell.column.getIsPinned()
                            ? getCommonPinningStyles(cell.column)
                            : undefined
                        }
                        onClick={(event) => {
                          if (
                            cell.column.id === "role" ||
                            cell.column.id === "id"
                          ) {
                            event.stopPropagation();
                          }
                        }}
                      >
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
            {hasNext ? (
              <LoadMoreRow
                onLoadMore={() => loadNext(PAGE_SIZE)}
                key="load-more"
                isLoadingNext={isLoadingNext}
              />
            ) : null}
          </tbody>
        )}
        <ModalOverlay
          isOpen={dialog !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setDialog(null);
            }
          }}
          isDismissable
        >
          <Modal size="S">{dialog}</Modal>
        </ModalOverlay>
      </table>
    </div>
  );
}
