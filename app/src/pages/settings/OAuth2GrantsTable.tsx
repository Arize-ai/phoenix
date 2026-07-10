import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { startTransition, useCallback, useMemo, useState } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import {
  Alert,
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmptyWrap } from "@phoenix/components/table/TableEmptyWrap";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { OAuth2GrantsTableFragment$key } from "./__generated__/OAuth2GrantsTableFragment.graphql";
import type { OAuth2GrantsTableQuery } from "./__generated__/OAuth2GrantsTableQuery.graphql";

const TIMESTAMP_CELL_SIZE = 70;

function RevokeOAuth2GrantButton({
  clientName,
  handleRevoke,
}: {
  clientName: string;
  handleRevoke: () => void;
}) {
  return (
    <DialogTrigger>
      <Button
        variant="danger"
        size="S"
        leadingVisual={<Icon svg={<Icons.Trash />} />}
        aria-label="Revoke application access"
      />
      <ModalOverlay isDismissable>
        <Modal>
          <Dialog>
            {({ close }) => (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Revoke Application Access</DialogTitle>
                  <DialogTitleExtra>
                    <DialogCloseButton slot="close" />
                  </DialogTitleExtra>
                </DialogHeader>
                <View padding="size-200">
                  <Text color="danger">
                    {`Are you sure you want to revoke access for "${clientName}"? Its tokens will stop working immediately and the user will need to authorize the application again.`}
                  </Text>
                </View>
                <View
                  paddingEnd="size-200"
                  paddingTop="size-100"
                  paddingBottom="size-100"
                  borderTopColor="default"
                  borderTopWidth="thin"
                >
                  <Flex direction="row" justifyContent="end" gap="size-100">
                    <Button slot="close" size="S">
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="S"
                      onPress={() => {
                        handleRevoke();
                        close();
                      }}
                    >
                      Revoke Access
                    </Button>
                  </Flex>
                </View>
              </DialogContent>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export function OAuth2GrantsTable({
  query,
}: {
  query: OAuth2GrantsTableFragment$key;
}) {
  "use no memo";
  const [data, refetch] = useRefetchableFragment<
    OAuth2GrantsTableQuery,
    OAuth2GrantsTableFragment$key
  >(
    graphql`
      fragment OAuth2GrantsTableFragment on Query
      @refetchable(queryName: "OAuth2GrantsTableQuery") {
        oauth2Grants {
          id
          clientName
          clientId
          isFirstParty
          createdAt
          expiresAt
          lastUsedAt
          user {
            username
          }
        }
      }
    `,
    query
  );

  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [commit] = useMutation(graphql`
    mutation OAuth2GrantsTableRevokeMutation($input: RevokeOAuth2GrantInput!) {
      revokeOAuth2Grant(input: $input) {
        grantId
      }
    }
  `);
  const handleRevoke = useCallback(
    (id: string) => {
      commit({
        variables: {
          input: {
            id,
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "Application access revoked",
            message:
              "The application's tokens have been revoked and are no longer active.",
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
          setError(formattedError?.[0] ?? error.message);
        },
      });
    },
    [commit, notifySuccess, refetch]
  );

  const tableData = useMemo(() => {
    return [...data.oauth2Grants];
  }, [data]);

  type TableRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "Application",
        accessorKey: "clientName",
        size: 100,
        cell: TextCell,
      },
      {
        header: "Client ID",
        accessorKey: "clientId",
        cell: TextCell,
      },
      {
        header: "User",
        size: 120,
        accessorKey: "user.username",
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
        header: "Last Used At",
        accessorKey: "lastUsedAt",
        size: TIMESTAMP_CELL_SIZE,
        cell: TimestampCell,
      },
      {
        header: "",
        accessorKey: "id",
        size: 10,
        cell: ({ row }) => {
          return (
            <Flex direction="row" justifyContent="end" width="100%">
              <RevokeOAuth2GrantButton
                clientName={row.original.clientName}
                handleRevoke={() => {
                  handleRevoke(row.original.id);
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
  }, [handleRevoke]);
  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = table.getRowModel().rows.length === 0;
  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
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
          <TableEmptyWrap>
            <EmptyState
              graphic={<EmptyStateGraphic variant="credential" />}
              description="No authorized applications"
            />
          </TableEmptyWrap>
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
    </>
  );
}
