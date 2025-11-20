import { useEffect, useMemo, useRef } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Card, Flex, Icon, Icons, Text, View } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";
import { useNotifyError } from "@phoenix/contexts";

import type { SecretsCard_data$key } from "./__generated__/SecretsCard_data.graphql";
import { DeleteSecretButton } from "./DeleteSecretButton";
import { NewSecretButton } from "./NewSecretButton";
import { UpsertSecretButton } from "./UpsertSecretButton";

export function SecretsCard({ query }: { query: SecretsCard_data$key }) {
  const notifyError = useNotifyError();
  const data = useFragment<SecretsCard_data$key>(
    graphql`
      fragment SecretsCard_data on Query
      @refetchable(queryName: "SecretsCardQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 50 }
      ) {
        secrets(first: $first, after: $after)
          @connection(key: "SecretsCard_secrets") {
          edges {
            node {
              id
              key
              value
              shadowsEnvironmentVariable
            }
          }
        }
      }
    `,
    query
  );

  const tableData = useMemo(
    () => data.secrets.edges.map((edge) => edge.node),
    [data.secrets.edges]
  );

  // Notify user if there are any secrets with decryption errors
  const hasNotifiedErrorsRef = useRef(false);
  useEffect(() => {
    if (hasNotifiedErrorsRef.current) return;

    const secretsWithErrors = tableData.filter(
      (secret) => secret.value === null
    );
    if (secretsWithErrors.length > 0) {
      hasNotifiedErrorsRef.current = true;
      const errorKeys = secretsWithErrors.map((s) => s.key).join(", ");
      notifyError({
        title: "Secret decryption error",
        message: `Unable to decrypt ${secretsWithErrors.length} secret(s): ${errorKeys}. The encryption key may have changed.`,
        expireMs: 10000,
      });
    }
  }, [tableData, notifyError]);

  type DataRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    const cols: ColumnDef<DataRow>[] = [
      {
        header: "Key",
        accessorKey: "key",
        cell: ({ getValue }) => {
          const value = getValue<string>();
          return <Text fontFamily="mono">{value}</Text>;
        },
      },
      {
        header: "Shadows Env Var",
        accessorKey: "shadowsEnvironmentVariable",
        cell: ({ getValue }) => {
          const shadowsEnvVar = getValue<boolean>();
          return (
            <Text color={shadowsEnvVar ? "warning" : "text-700"}>
              {shadowsEnvVar ? "Yes" : "No"}
            </Text>
          );
        },
      },
      {
        header: "",
        accessorKey: "id",
        size: 10,
        enableSorting: false,
        cell: ({ row }) => {
          return (
            <Flex
              direction="row"
              justifyContent="end"
              gap="size-50"
              width="100%"
            >
              <UpsertSecretButton
                secretKey={row.original.key}
                currentValue={row.original.value}
              />
              <DeleteSecretButton secretKey={row.original.key} />
            </Flex>
          );
        },
      },
    ];

    return cols;
  }, []);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<DataRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <Card title="Secrets" extra={<NewSecretButton />}>
      <View paddingBottom="size-100">
        <Text size="S" color="text-700">
          Secrets are encrypted values that can be referenced in custom
          providers. Use environment variable references in your custom provider
          configurations to securely access these values.
        </Text>
      </View>
      {isEmpty ? (
        <View padding="size-200">
          <Flex
            direction="column"
            gap="size-100"
            alignItems="center"
            justifyContent="center"
          >
            <Icon svg={<Icons.FileTextOutline />} />
            <Text color="text-700">No secrets configured yet.</Text>
            <Text size="XS" color="text-700">
              Create a secret to securely store sensitive values like API keys.
            </Text>
          </Flex>
        </View>
      ) : (
        <table css={tableCSS}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th colSpan={header.colSpan} key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
        </table>
      )}
    </Card>
  );
}
