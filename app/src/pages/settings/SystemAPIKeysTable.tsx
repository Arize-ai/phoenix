import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { startTransition, useCallback, useMemo, useState } from "react";
import { graphql, useMutation, useRefetchableFragment } from "react-relay";

import { Alert, Flex, Icon, Icons, View } from "@phoenix/components";
import { DeleteAPIKeyButton } from "@phoenix/components/auth";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { TextCell } from "@phoenix/components/table";
import {
  getCommonPinningStyles,
  tableCSS,
} from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SystemAPIKeysTableFragment$key } from "./__generated__/SystemAPIKeysTableFragment.graphql";
import type { SystemAPIKeysTableQuery } from "./__generated__/SystemAPIKeysTableQuery.graphql";

const API_KEY_NAME_COLUMN_SIZE = 220;
const API_KEY_DESCRIPTION_COLUMN_SIZE = 360;
const API_KEY_TIMESTAMP_COLUMN_SIZE = 220;
const API_KEY_ACTIONS_COLUMN_SIZE = 56;

const apiKeysTableContainerCSS = css`
  overflow: auto;
`;

const apiKeysTableHeaderCSS = css`
  white-space: nowrap;
`;

export function SystemAPIKeysTable({
  query,
}: {
  query: SystemAPIKeysTableFragment$key;
}) {
  "use no memo";
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
        viewer {
          ...ViewerAPIKeysListFragment
        }
      }
    `,
    query
  );

  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
  const [commit] = useMutation(graphql`
    mutation SystemAPIKeysTableDeleteAPIKeyMutation(
      $input: DeleteApiKeyInput!
    ) {
      deleteSystemApiKey(input: $input) {
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
            title: "System key deleted",
            message: "The system key has been deleted and is no longer active.",
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
    return [...data.systemApiKeys];
  }, [data]);

  type TableRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols: ColumnDef<TableRow>[] = [
      {
        header: "Name",
        accessorKey: "name",
        size: API_KEY_NAME_COLUMN_SIZE,
      },
      {
        header: "Description",
        accessorKey: "description",
        size: API_KEY_DESCRIPTION_COLUMN_SIZE,
        cell: TextCell,
      },
      {
        header: "Created At",
        accessorKey: "createdAt",
        size: API_KEY_TIMESTAMP_COLUMN_SIZE,
        cell: TimestampCell,
      },
      {
        header: "Expires At",
        accessorKey: "expiresAt",
        size: API_KEY_TIMESTAMP_COLUMN_SIZE,
        cell: TimestampCell,
      },
      {
        id: "actions",
        header: "",
        accessorKey: "id",
        size: API_KEY_ACTIONS_COLUMN_SIZE,
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
  });
  const rows = table.getRowModel().rows;
  const isEmpty = table.getRowModel().rows.length === 0;
  if (isEmpty) {
    return (
      <>
        {error && <Alert variant="danger">{error}</Alert>}
        <View padding="size-500">
          <EmptyState
            graphic={<EmptyStateGraphic variant="credential" />}
            description="No system keys"
          />
        </View>
      </>
    );
  }

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      <div css={apiKeysTableContainerCSS}>
        <table
          css={tableCSS}
          style={{ width: table.getTotalSize(), minWidth: "100%" }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    colSpan={header.colSpan}
                    key={header.id}
                    css={apiKeysTableHeaderCSS}
                    style={{
                      width: header.column.getSize(),
                      minWidth: header.column.getSize(),
                      maxWidth: header.column.getSize(),
                      ...(header.column.getIsPinned()
                        ? getCommonPinningStyles(header.column)
                        : {}),
                      zIndex: header.column.getIsPinned() ? 1 : undefined,
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
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => {
              return (
                <tr key={row.id}>
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
          </tbody>
        </table>
      </div>
    </>
  );
}
