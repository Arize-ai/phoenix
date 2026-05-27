import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Button,
  Card,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
} from "@phoenix/components";
import {
  GenerativeProviderIcon,
  ProviderCredentialsDialog,
} from "@phoenix/components/generative";
import { tableCSS } from "@phoenix/components/table/styles";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type {
  GenerativeProvidersCard_data$data,
  GenerativeProvidersCard_data$key,
} from "./__generated__/GenerativeProvidersCard_data.graphql";

export function GenerativeProvidersCard({
  query,
}: {
  query: GenerativeProvidersCard_data$key;
}) {
  "use no memo";
  const data = useFragment<GenerativeProvidersCard_data$key>(
    graphql`
      fragment GenerativeProvidersCard_data on Query {
        modelProviders {
          name
          key
          dependenciesInstalled
          dependencies
          credentialRequirements {
            envVarName
            isRequired
          }
          credentialsSet
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
        header: "Environment Variables",
        accessorKey: "apiKeyEnvVar",
        cell: ({ row }) => {
          const envVars =
            row.original.credentialRequirements
              .map((config) => config.envVarName)
              .join(", ") || "--";
          return <Text>{envVars}</Text>;
        },
      },
      {
        header: "Configuration",
        accessorKey: "credentialsSet",
        cell: ({ row }) => {
          return (
            <ProviderCredentialsStatus
              dependenciesInstalled={row.original.dependenciesInstalled}
              credentialRequirements={row.original.credentialRequirements}
              providerKey={row.original.key}
              credentialsSet={row.original.credentialsSet}
            />
          );
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
              <DialogTrigger>
                <Button
                  size="S"
                  aria-label={`Edit ${row.original.name} credentials`}
                  leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                  isDisabled={row.original.credentialRequirements.length === 0}
                />
                <ModalOverlay>
                  <Modal size="M">
                    <ProviderCredentialsDialog provider={row.original} />
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
            </Flex>
          );
        },
      },
    ] satisfies ColumnDef<DataRow>[];
  }, []);

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<(typeof tableData)[number]>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <Card title="AI Providers">
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
    </Card>
  );
}

function ProviderCredentialsStatus({
  dependenciesInstalled,
  credentialRequirements,
  providerKey,
  credentialsSet,
}: {
  dependenciesInstalled: boolean;
  credentialRequirements: GenerativeProvidersCard_data$data["modelProviders"][number]["credentialRequirements"];
  providerKey: GenerativeProvidersCard_data$data["modelProviders"][number]["key"];
  credentialsSet: boolean;
}) {
  const providerCredentials = useCredentialsContext((state) =>
    isModelProvider(providerKey) ? state[providerKey] : undefined
  );
  if (!dependenciesInstalled) {
    return <Text color="warning">missing dependencies</Text>;
  }

  // Check if any credentials are set locally
  if (!isModelProvider(providerKey)) {
    return <Text color="warning">unknown provider key</Text>;
  }
  const hasLocalCredentials = credentialRequirements.every(
    ({ envVarName, isRequired }) => {
      const envVarSet = !!providerCredentials?.[envVarName];
      return envVarSet || !isRequired;
    }
  );
  if (credentialRequirements.length === 0) {
    return <Text color="success">no credentials required</Text>;
  }
  if (hasLocalCredentials) {
    return <Text color="success">local</Text>;
  }
  if (credentialsSet) {
    return <Text color="success">configured on the server</Text>;
  }
  return <Text color="text-700">not configured</Text>;
}
