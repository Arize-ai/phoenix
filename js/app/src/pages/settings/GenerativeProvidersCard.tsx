import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useContext, useMemo } from "react";
import { OverlayTriggerStateContext } from "react-aria-components";
import { graphql, useFragment } from "react-relay";

import {
  Button,
  Card,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  DialogTrigger,
  DocumentationHelp,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  Modal,
  ModalOverlay,
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import {
  GenerativeProviderIcon,
  ProviderBrowserCredentialsPanel,
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
    <Card
      title="AI Providers"
      titleExtra={
        <DocumentationHelp topic="aiProviders">
          Configure credentials for built-in AI providers used by the Playground
          and evaluations.
        </DocumentationHelp>
      }
    >
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
    return <Text color="success">configured in this browser</Text>;
  }
  if (credentialsSet) {
    return <Text color="success">configured on the server</Text>;
  }
  return <Text color="text-700">not configured</Text>;
}

function CredentialsSetIndicator() {
  return (
    <Icon
      color="success"
      svg={<Icons.Checkmark />}
      aria-label="credentials set"
      css={css`
        font-size: var(--global-font-size-s);
      `}
    />
  );
}

function ProviderCredentialsDialog({
  provider,
}: {
  provider: GenerativeProvidersCard_data$data["modelProviders"][number];
}) {
  const { viewer } = useViewer();
  const isAdmin = !viewer || viewer.role?.name === "ADMIN";
  const providerKey = provider.key;
  const hasBrowserCredentials = useCredentialsContext((state) => {
    if (!isModelProvider(providerKey)) {
      return false;
    }
    const providerCredentials = state[providerKey];
    return provider.credentialRequirements.some(
      ({ envVarName }) => !!providerCredentials?.[envVarName]
    );
  });
  const overlayState = useContext(OverlayTriggerStateContext);
  const closeDialog = useCallback(() => {
    overlayState?.close();
  }, [overlayState]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {provider.name} Credentials</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        {isAdmin ? (
          <>
            <View paddingX="size-200" paddingY="size-100">
              <Text size="XS" color="text-700">
                Credentials can be stored in two places: in this browser for
                your personal use, and on the server to share with all users.
              </Text>
            </View>
            <Tabs defaultSelectedKey="browser">
              <TabList aria-label="Credential storage location">
                <Tab id="browser">
                  <Flex direction="row" alignItems="center" gap="size-50">
                    <Text>Browser</Text>
                    {hasBrowserCredentials && <CredentialsSetIndicator />}
                  </Flex>
                </Tab>
                <Tab id="server">
                  <Flex direction="row" alignItems="center" gap="size-50">
                    <Text>Server</Text>
                    {provider.credentialsSet && <CredentialsSetIndicator />}
                  </Flex>
                </Tab>
              </TabList>
              <LazyTabPanel id="browser">
                <View padding="size-200">
                  <ProviderBrowserCredentialsPanel
                    provider={provider}
                    onSaved={closeDialog}
                  />
                </View>
              </LazyTabPanel>
              <LazyTabPanel id="server">
                <View padding="size-200">
                  <ProviderServerCredentialsPanel
                    provider={provider}
                    onSaved={closeDialog}
                  />
                </View>
              </LazyTabPanel>
            </Tabs>
          </>
        ) : (
          <View padding="size-200" paddingTop="size-100">
            <Flex direction="column" gap="size-100">
              <Text size="XS" color="text-700">
                To configure shared credentials for all users on the server,
                contact an administrator.
              </Text>
              <ProviderBrowserCredentialsPanel
                provider={provider}
                onSaved={closeDialog}
              />
            </Flex>
          </View>
        )}
      </DialogContent>
    </Dialog>
  );
}
