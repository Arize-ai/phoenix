import { css } from "@emotion/react";
import { flexRender, useTable } from "@tanstack/react-table";
import { useCallback, useContext, useMemo, useState } from "react";
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
  DocumentationHelp,
  Flex,
  Icon,
  Icons,
  LazyTabPanel,
  MarkerTrigger,
  StatusIndicator,
  ViewportModal,
  ViewportModalOverlay,
  Tab,
  TabList,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import type { StatusCategory } from "@phoenix/components";
import {
  GenerativeProviderIcon,
  ProviderBrowserCredentialsPanel,
  ProviderServerCredentialsPanel,
} from "@phoenix/components/generative";
import { getMissingCredentialsStatus } from "@phoenix/components/generative/modelProviderUtils";
import { tableCSS } from "@phoenix/components/table/styles";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
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
  const [editingProviderKey, setEditingProviderKey] = useState<
    DataRow["key"] | null
  >(null);
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const editingProvider = tableData.find(
    (provider) => provider.key === editingProviderKey
  );
  const editCredentials = (providerKey: DataRow["key"]) => {
    setEditingProviderKey(providerKey);
    setIsEditingCredentials(true);
  };
  const columns = [
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
            provider={row.original}
            onConfigure={() => editCredentials(row.original.key)}
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
            <Button
              size="S"
              aria-label={`Edit ${row.original.name} credentials`}
              leadingVisual={<Icon svg={<Icons.Edit />} />}
              isDisabled={row.original.credentialRequirements.length === 0}
              onPress={() => editCredentials(row.original.key)}
            />
          </Flex>
        );
      },
    },
  ] satisfies ColumnDef<DataRow>[];

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: tableData,
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
      <ViewportModalOverlay
        isOpen={isEditingCredentials && editingProvider != null}
        onOpenChange={setIsEditingCredentials}
      >
        <ViewportModal size="M">
          {editingProvider ? (
            <ProviderCredentialsDialog provider={editingProvider} />
          ) : null}
        </ViewportModal>
      </ViewportModalOverlay>
    </Card>
  );
}

type ModelProvider =
  GenerativeProvidersCard_data$data["modelProviders"][number];

function ProviderCredentialsStatus({
  provider,
  onConfigure,
}: {
  provider: ModelProvider;
  onConfigure: () => void;
}) {
  const providerCredentials = useCredentialsContext((state) =>
    isModelProvider(provider.key) ? state[provider.key] : undefined
  );
  const hasLocalCredentials = provider.credentialRequirements.every(
    ({ envVarName, isRequired }) =>
      !!providerCredentials?.[envVarName] || !isRequired
  );
  const status = getProviderCredentialsStatus({
    provider,
    hasLocalCredentials,
  });
  const indicator = <StatusIndicator {...status} />;
  if (status.category === "needs-credentials") {
    return (
      <MarkerTrigger
        aria-label={`${status.label}: configure ${provider.name} credentials`}
        onPress={onConfigure}
      >
        {indicator}
      </MarkerTrigger>
    );
  }
  return indicator;
}

export function getProviderCredentialsStatus({
  provider,
  hasLocalCredentials,
}: {
  provider: ModelProvider;
  hasLocalCredentials: boolean;
}): { category: StatusCategory; label: string; detail?: string } {
  if (!provider.dependenciesInstalled) {
    return { category: "unavailable", label: "Not installed" };
  }
  if (!isModelProvider(provider.key)) {
    return { category: "failed", label: "Unknown provider" };
  }
  if (provider.credentialRequirements.length === 0) {
    return { category: "succeeded", label: "Ready" };
  }
  if (hasLocalCredentials) {
    return {
      category: "succeeded",
      label: "Configured",
      detail: "In this browser",
    };
  }
  if (provider.credentialsSet) {
    return {
      category: "succeeded",
      label: "Configured",
      detail: "On the server",
    };
  }
  return getMissingCredentialsStatus({ providerKey: provider.key });
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
