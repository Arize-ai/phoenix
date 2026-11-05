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
import { providerSupportsDefaultCredentialChain } from "@phoenix/components/generative/modelProviderUtils";
import { tableCSS } from "@phoenix/components/table/styles";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { assertUnreachable } from "@phoenix/typeUtils";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import type {
  GenerativeProvidersCard_data$data,
  GenerativeProvidersCard_data$key,
} from "./__generated__/GenerativeProvidersCard_data.graphql";
import { ProviderCredentialsDialog } from "./ProviderCredentialsDialog";
import type {
  CredentialPresence,
  CredentialSource,
} from "./providerCredentialSources";
import {
  CREDENTIAL_SOURCES,
  getSourceCompleteness,
} from "./providerCredentialSources";

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
  const browserKeys = useCredentialsContext((state) => {
    if (!isModelProvider(provider.key)) {
      return "";
    }
    const credentials = state[provider.key];
    return provider.credentialRequirements
      .map(({ envVarName }) => envVarName)
      .filter((envVarName) => !!credentials?.[envVarName])
      .join(",");
  });
  const credentials = getProviderCredentials(
    provider,
    new Set(browserKeys ? browserKeys.split(",") : [])
  );
  if (credentials.kind === "status") {
    return <StatusIndicator {...credentials.status} />;
  }
  return (
    <MarkerTrigger
      aria-label={`Configure ${provider.name} credentials`}
      onPress={onConfigure}
    >
      {credentials.kind === "default-chain" ? (
        <StatusIndicator category="unset" label="Default credentials" />
      ) : (
        credentials.sources.map((source) => (
          <StatusIndicator key={source.label} {...source} />
        ))
      )}
    </MarkerTrigger>
  );
}

const SOURCE_LABELS: Record<CredentialSource, string> = {
  browser: "Browser",
  secret: "Secret",
  environment: "Environment",
};

type ProviderCredentials =
  | {
      kind: "status";
      status: { category: StatusCategory; label: string };
    }
  | { kind: "default-chain" }
  | {
      kind: "sources";
      sources: { category: StatusCategory; label: string; detail?: string }[];
    };

/**
 * A provider that takes credentials shows how completely each source sets
 * them, in the order Phoenix uses them. One with a default credential chain
 * and nothing set says it uses that chain. Any other provider shows why it
 * takes none.
 */
export function getProviderCredentials(
  provider: ModelProvider,
  browserKeys: ReadonlySet<string>
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
  const presence = getSavedCredentialPresence(requirements, browserKeys);
  const sources = CREDENTIAL_SOURCES.map((source) => ({
    source,
    completeness: getSourceCompleteness(requirements, presence[source]),
  }));
  if (
    sources.every(({ completeness }) => completeness.state === "unset") &&
    providerSupportsDefaultCredentialChain({ providerKey: provider.key })
  ) {
    return { kind: "default-chain" };
  }
  return {
    kind: "sources",
    sources: sources.map(({ source, completeness }) => {
      const label = SOURCE_LABELS[source];
      switch (completeness.state) {
        case "set":
          return { category: "succeeded", label };
        case "partial":
          return {
            category: "needs-credentials",
            label,
            detail: `${completeness.setCount} of ${completeness.requiredCount}`,
          };
        case "unset":
          return { category: "unset", label };
        default:
          return assertUnreachable(completeness);
      }
    }),
  };
}

function getSavedCredentialPresence(
  requirements: ModelProvider["credentialRequirements"],
  browserKeys: ReadonlySet<string>
): CredentialPresence {
  const namesWhere = (
    isSet: (requirement: (typeof requirements)[number]) => boolean
  ) => new Set(requirements.filter(isSet).map(({ envVarName }) => envVarName));
  return {
    browser: browserKeys,
    secret: namesWhere(({ isSetAsSecret }) => isSetAsSecret),
    environment: namesWhere(({ isSetInEnvironment }) => isSetInEnvironment),
  };
}
