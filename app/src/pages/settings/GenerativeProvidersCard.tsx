import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";

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
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";
import {
  GenerativeProviderIcon,
  ProviderServerCredentialsPanel,
} from "@phoenix/components/generative";
import { tableCSS } from "@phoenix/components/table/styles";
import { useViewer } from "@phoenix/contexts";
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
                  leadingVisual={<Icon svg={<Icons.Edit />} />}
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

type CredentialViewType = "browser" | "secrets";

function ProviderCredentialsDialog({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  const { viewer } = useViewer();
  const isAdmin = !viewer || viewer.role?.name === "ADMIN";
  const [credentialView, setCredentialView] =
    useState<CredentialViewType>("browser");

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Configure {isAdmin ? "" : "Local "}
            {provider.name} Credentials
          </DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          {isAdmin ? (
            <Flex direction="column" gap="size-200">
              <ToggleButtonGroup
                selectedKeys={[credentialView]}
                size="S"
                aria-label="Credential Source"
                onSelectionChange={(v) => {
                  if (v.size === 0) {
                    return;
                  }
                  const view = v.keys().next().value as CredentialViewType;
                  if (view === "browser" || view === "secrets") {
                    setCredentialView(view);
                  }
                }}
              >
                <ToggleButton aria-label="Browser" id="browser">
                  Browser
                </ToggleButton>
                <ToggleButton aria-label="Secrets" id="secrets">
                  Secrets
                </ToggleButton>
              </ToggleButtonGroup>
              {credentialView === "browser" && (
                <>
                  <View paddingBottom="size-100">
                    <Text size="XS" color="text-700">
                      Credentials stored in your browser. Only you can see
                      these, and they are sent with each API request.
                    </Text>
                  </View>
                  <Form>
                    <BrowserCredentials provider={provider} />
                  </Form>
                </>
              )}
              {credentialView === "secrets" && (
                <ProviderServerCredentialsPanel provider={provider} />
              )}
            </Flex>
          ) : (
            <>
              <View paddingBottom="size-100">
                <Text size="XS">
                  Set the credentials for the {provider.name} API. These
                  credentials will be stored entirely in your browser and will
                  only be sent to the server during API requests.
                </Text>
              </View>
              <Form>
                <BrowserCredentials provider={provider} />
              </Form>
            </>
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}

function BrowserCredentials({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  const providerKey = provider.key;
  const isValidProvider = isModelProvider(providerKey);

  const { setCredential, credentials } = useCredentialsContext((state) => ({
    setCredential: state.setCredential,
    credentials: isValidProvider ? state[providerKey] : undefined,
  }));
  const credentialRequirements = provider.credentialRequirements;

  const clearLocalCredentials = useCallback(() => {
    if (!isValidProvider) return;
    provider.credentialRequirements.forEach(({ envVarName }) => {
      setCredential({
        provider: providerKey,
        envVarName,
        value: "",
      });
    });
  }, [provider, providerKey, isValidProvider, setCredential]);

  if (!isValidProvider) {
    return <Text color="warning">Unknown provider type: {providerKey}</Text>;
  }

  if (provider.credentialRequirements.length === 0) {
    return <Text color="text-700">Browser credentials are not required.</Text>;
  }

  return (
    <Flex direction="column" gap="size-100">
      {credentialRequirements.map(({ envVarName, isRequired }) => (
        <CredentialField
          key={envVarName}
          isRequired={isRequired}
          onChange={(value) => {
            setCredential({
              provider: providerKey,
              envVarName,
              value,
            });
          }}
          value={credentials?.[envVarName] ?? ""}
        >
          <Label>{envVarName}</Label>
          <CredentialInput />
        </CredentialField>
      ))}
      <Button
        onPress={clearLocalCredentials}
        css={css`
          align-self: flex-start;
          margin-top: var(--global-dimension-size-100);
        `}
      >
        Clear Local Credentials
      </Button>
    </Flex>
  );
}
