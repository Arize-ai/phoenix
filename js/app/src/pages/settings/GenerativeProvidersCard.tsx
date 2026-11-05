import { flexRender, useTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Button,
  Card,
  DocumentationHelp,
  Flex,
  Icon,
  Icons,
  MarkerTrigger,
  StatusIndicator,
  Text,
  ViewportModal,
  ViewportModalOverlay,
} from "@phoenix/components";
import type { StatusCategory } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import { tableCSS } from "@phoenix/components/table/styles";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type {
  GenerativeProvidersCard_data$data,
  GenerativeProvidersCard_data$key,
} from "./__generated__/GenerativeProvidersCard_data.graphql";
import { ProviderCredentialsDialog } from "./ProviderCredentialsDialog";

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
            isSetInEnvironment
            isSetAsSecret
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
  const editCredentials = useCallback((providerKey: DataRow["key"]) => {
    setEditingProviderKey(providerKey);
    setIsEditingCredentials(true);
  }, []);
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
        header: "Credentials",
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
  }, [editCredentials]);

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
  const hasBrowserCredential = useCredentialsContext((state) => {
    if (!isModelProvider(provider.key)) {
      return false;
    }
    const credentials = state[provider.key];
    return provider.credentialRequirements.some(
      ({ envVarName }) => !!credentials?.[envVarName]
    );
  });
  const credentials = getProviderCredentials(provider, hasBrowserCredential);
  if (credentials.kind === "status") {
    return <StatusIndicator {...credentials.status} />;
  }
  return (
    <MarkerTrigger
      aria-label={`Configure ${provider.name} credentials`}
      onPress={onConfigure}
    >
      {credentials.sources.map(({ label, isSet }) => (
        <StatusIndicator
          key={label}
          category={isSet ? "succeeded" : "unset"}
          label={label}
        />
      ))}
    </MarkerTrigger>
  );
}

type ProviderCredentials =
  | {
      kind: "status";
      status: { category: StatusCategory; label: string };
    }
  | {
      kind: "sources";
      sources: {
        label: "Browser" | "Secret" | "Environment";
        isSet: boolean;
      }[];
    };

/**
 * A provider that takes credentials shows where they are set, in the order
 * Phoenix uses them; any other provider shows why it takes none.
 */
export function getProviderCredentials(
  provider: ModelProvider,
  hasBrowserCredential: boolean
): ProviderCredentials {
  if (!provider.dependenciesInstalled) {
    return {
      kind: "status",
      status: { category: "unavailable", label: "Not installed" },
    };
  }
  if (!isModelProvider(provider.key)) {
    return {
      kind: "status",
      status: { category: "failed", label: "Unknown provider" },
    };
  }
  const requirements = provider.credentialRequirements;
  if (requirements.length === 0) {
    return {
      kind: "status",
      status: { category: "succeeded", label: "Ready" },
    };
  }
  return {
    kind: "sources",
    sources: [
      { label: "Browser", isSet: hasBrowserCredential },
      {
        label: "Secret",
        isSet: requirements.some(({ isSetAsSecret }) => isSetAsSecret),
      },
      {
        label: "Environment",
        isSet: requirements.some(
          ({ isSetInEnvironment }) => isSetInEnvironment
        ),
      },
    ],
  };
}
