import { useCallback, useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Button,
  Card,
  CredentialField,
  CredentialInput,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  Flex,
  Form,
  Icon,
  Icons,
  Label,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import { tableCSS } from "@phoenix/components/table/styles";
import { ProviderToCredentialsConfigMap } from "@phoenix/constants/generativeConstants";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import {
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
          const credentialsConfig =
            ProviderToCredentialsConfigMap[row.original.key];
          const envVars =
            credentialsConfig?.map((config) => config.envVarName).join(", ") ||
            row.original.credentialRequirements
              .map((config) => config.envVarName)
              .join(", ") ||
            "--";
          return <Text>{envVars}</Text>;
        },
      },
      {
        header: "configuration",
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
                  leadingVisual={<Icon svg={<Icons.EditOutline />} />}
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

  // eslint-disable-next-line react-hooks/incompatible-library
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
  const credentials = useCredentialsContext((state) => state);
  if (!dependenciesInstalled) {
    return <Text color="warning">missing dependencies</Text>;
  }

  // Check if any credentials are set locally
  if (!isModelProvider(providerKey)) {
    return <Text color="warning">unknown provider key</Text>;
  }
  const providerCredentials = credentials[providerKey];
  const hasLocalCredentials = credentialRequirements.every(
    ({ envVarName, isRequired }) => {
      const envVarSet = !!providerCredentials?.[envVarName];
      return envVarSet || !isRequired;
    }
  );

  if (hasLocalCredentials) {
    return <Text color="success">local</Text>;
  }
  if (credentialsSet) {
    return <Text color="success">configured on the server</Text>;
  }
  return <Text color="text-700">not configured</Text>;
}

function ProviderCredentialsDialog({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Local {provider.name} Credentials</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <View paddingBottom="size-100">
            <Text size="XS">
              Set the credentials for the {provider.name} API. These credentials
              will be stored entirely in your browser and will only be sent to
              the server during API requests.
            </Text>
          </View>
          <Form>
            <ProviderCredentials provider={provider.key} />
          </Form>
        </View>
      </DialogContent>
    </Dialog>
  );
}

function ProviderCredentials({ provider }: { provider: ModelProvider }) {
  const setCredential = useCredentialsContext((state) => state.setCredential);
  const credentialsConfig = ProviderToCredentialsConfigMap[provider];
  const credentials = useCredentialsContext((state) => state[provider]);

  const clearLocalCredentials = useCallback(() => {
    credentialsConfig.forEach((credentialConfig) => {
      setCredential({
        provider,
        envVarName: credentialConfig.envVarName,
        value: "",
      });
    });
  }, [provider, credentialsConfig, setCredential]);

  return (
    <Flex direction="column" gap="size-100">
      {credentialsConfig.map((credentialConfig) => (
        <CredentialField
          key={credentialConfig.envVarName}
          isRequired={credentialConfig.isRequired}
          onChange={(value) => {
            setCredential({
              provider,
              envVarName: credentialConfig.envVarName,
              value,
            });
          }}
          value={credentials?.[credentialConfig.envVarName] ?? ""}
        >
          <Label>{credentialConfig.envVarName}</Label>
          <CredentialInput />
        </CredentialField>
      ))}
      <Button
        onPress={clearLocalCredentials}
        css={css`
          align-self: flex-start;
          margin-top: var(--ac-global-dimension-size-100);
        `}
      >
        Clear Local Credentials
      </Button>
    </Flex>
  );
}
