import { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Card, Dialog, DialogContainer } from "@arizeai/components";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import { tableCSS } from "@phoenix/components/table/styles";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";

import {
  GenerativeProvidersCard_data$data,
  GenerativeProvidersCard_data$key,
} from "./__generated__/GenerativeProvidersCard_data.graphql";

export function GenerativeProvidersCard({
  query,
}: {
  query: GenerativeProvidersCard_data$key;
}) {
  const [selectedProvider, setSelectedProvider] = useState<
    GenerativeProvidersCard_data$data["modelProviders"][number] | null
  >(null);
  const credentials = useCredentialsContext((state) => state);
  const setCredential = useCredentialsContext((state) => state.setCredential);
  const data = useFragment<GenerativeProvidersCard_data$key>(
    graphql`
      fragment GenerativeProvidersCard_data on Query {
        modelProviders {
          name
          key
          dependenciesInstalled
          dependencies
          apiKeyEnvVar
          apiKeySet
        }
      }
    `,
    query
  );

  const tableData = useMemo(() => [...data.modelProviders], [data]);
  type DataRow = (typeof tableData)[number];
  const columns = useMemo(() => {
    return [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => {
          return (
            <Flex direction="row" alignItems="center" gap="size-100">
              <GenerativeProviderIcon provider={row.original.key} height={18} />
              {row.original.name}
            </Flex>
          );
        },
      },
      {
        header: "Environment Variable",
        accessorKey: "apiKeyEnvVar",
        cell: ({ row }) => {
          return <Text>{row.original.apiKeyEnvVar}</Text>;
        },
      },
      {
        header: "configuration",
        accessorKey: "apiKeySet",
        cell: ({ row }) => {
          if (!row.original.dependenciesInstalled) {
            return <Text color="warning">missing dependencies</Text>;
          }
          if (credentials[row.original.key]) {
            return <Text color="success">local</Text>;
          }
          if (row.original.apiKeySet) {
            return <Text color="success">configured on the server</Text>;
          }
          return <Text color="text-700">not configured</Text>;
        },
      },
      {
        header: "",
        accessorKey: "id",
        cell: ({ row }) => {
          return (
            <Flex
              direction="row"
              justifyContent="end"
              gap="size-100"
              width="100%"
            >
              <Button
                size="S"
                leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                onPress={() => {
                  setSelectedProvider(row.original);
                }}
              />
            </Flex>
          );
        },
      },
    ] satisfies ColumnDef<DataRow>[];
  }, [credentials]);

  const table = useReactTable<(typeof tableData)[number]>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <Card title="AI Providers" bodyStyle={{ padding: 0 }} variant="compact">
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
      <DialogContainer
        type="modal"
        isDismissable={true}
        onDismiss={() => setSelectedProvider(null)}
      >
        {selectedProvider && (
          <Dialog title={`Set ${selectedProvider.name} API Key`} size="S">
            <View padding="size-200">
              <View paddingBottom="size-100">
                <Text size="XS">
                  Set the credentials for the {selectedProvider.name} API. These
                  credentials will be stored entirely in your browser and will
                  only be sent to the server during API requests.
                </Text>
              </View>
              <TextField
                onChange={(value) => {
                  setCredential({
                    provider: selectedProvider.key,
                    value,
                  });
                }}
                value={credentials[selectedProvider.key]}
                type="password"
              >
                <Label>{`${selectedProvider.name} API Key`}</Label>
                <Input placeholder={`e.g. ${selectedProvider.apiKeyEnvVar}`} />

                <Text slot="description">
                  The API key will be stored locally in your browser
                </Text>
              </TextField>
            </View>
            <View
              paddingX="size-200"
              paddingY="size-100"
              borderTopWidth="thin"
              borderColor="light"
            >
              <Flex direction="row" justifyContent="end" gap="size-100">
                <Button
                  variant="primary"
                  size="S"
                  onPress={() => {
                    setSelectedProvider(null);
                  }}
                >
                  Set API Key
                </Button>
              </Flex>
            </View>
          </Dialog>
        )}
      </DialogContainer>
    </Card>
  );
}
