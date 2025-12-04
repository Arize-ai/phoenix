import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Card, Flex, Icon, Icons, Text, View } from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { tableCSS } from "@phoenix/components/table/styles";
import { TimestampCell } from "@phoenix/components/table/TimestampCell";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/tooltip";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";
import { getProviderName } from "@phoenix/utils/generativeUtils";

import type {
  CustomProvidersCard_data$data,
  CustomProvidersCard_data$key,
  GenerativeModelCustomProviderSDK,
} from "./__generated__/CustomProvidersCard_data.graphql";

// Type alias for row data
type DataRow =
  CustomProvidersCard_data$data["generativeModelCustomProviders"]["edges"][number]["node"];
import { DeleteProviderButton } from "./DeleteCustomProviderButton";
import { EditProviderButton } from "./EditCustomProviderButton";
import { NewProviderButton } from "./NewCustomProviderButton";

/**
 * Mapping from SDK enum to ModelProvider key
 */
const SDK_TO_PROVIDER_MAP: Readonly<
  Partial<Record<GenerativeModelCustomProviderSDK, ModelProvider>>
> = {
  OPENAI: "OPENAI",
  AZURE_OPENAI: "AZURE_OPENAI",
  ANTHROPIC: "ANTHROPIC",
  AWS_BEDROCK: "AWS",
  GOOGLE_GENAI: "GOOGLE",
} as const;

/**
 * Mapping from normalized provider strings to ModelProvider keys
 */
const STRING_TO_PROVIDER_MAP: Readonly<Record<string, ModelProvider>> = {
  openai: "OPENAI",
  azure: "AZURE_OPENAI",
  azureopenai: "AZURE_OPENAI",
  anthropic: "ANTHROPIC",
  aws: "AWS",
  google: "GOOGLE",
  xai: "XAI",
  ollama: "OLLAMA",
  deepseek: "DEEPSEEK",
} as const;

interface ProviderDisplayInfo {
  providerKey: ModelProvider;
  displayText: string;
}

/**
 * Resolves provider information from provider string and SDK.
 * Returns the ModelProvider key and display text.
 * Priority: provider string match > SDK fallback > raw provider string
 */
function resolveProviderDisplay(
  providerString: string,
  sdk: GenerativeModelCustomProviderSDK
): ProviderDisplayInfo {
  // Normalize provider string for matching
  const normalized = providerString.toLowerCase().replace(/[_-]/g, "");

  const matchedProvider = STRING_TO_PROVIDER_MAP[normalized];

  if (matchedProvider) {
    // Provider string matched a known provider
    return {
      providerKey: matchedProvider,
      displayText: getProviderName(matchedProvider),
    };
  }

  // Fall back to SDK mapping
  const providerKey = SDK_TO_PROVIDER_MAP[sdk] ?? "OPENAI"; // Default to OPENAI for unknown SDKs

  // Use raw provider string if available and didn't match, otherwise use provider name
  const displayText = providerString
    ? providerString
    : getProviderName(providerKey);

  return { providerKey, displayText };
}

/**
 * Provider cell component - memoizes the resolved display info
 */
function ProviderCell({
  provider,
  sdk,
}: {
  provider: string;
  sdk: GenerativeModelCustomProviderSDK;
}) {
  const displayInfo = useMemo(
    () => resolveProviderDisplay(provider, sdk),
    [provider, sdk]
  );

  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <GenerativeProviderIcon provider={displayInfo.providerKey} height={18} />
      <span>{displayInfo.displayText}</span>
    </Flex>
  );
}

/**
 * Actions cell component for edit/delete buttons
 */
function ActionsCell({ row }: { row: DataRow }) {
  const parseError =
    (
      row as {
        config?: { parseError?: string | null };
      }
    ).config?.parseError ?? undefined;

  return (
    <Flex direction="row" justifyContent="end" gap="size-50" width="100%">
      {parseError ? (
        <TooltipTrigger delay={0}>
          <Icon
            svg={<Icons.AlertCircleOutline />}
            color="danger"
            aria-label="Configuration parse error"
          />
          <Tooltip>
            <TooltipArrow />
            <Text size="XS">{parseError}</Text>
          </Tooltip>
        </TooltipTrigger>
      ) : (
        <EditProviderButton provider={row} />
      )}
      <DeleteProviderButton provider={row} />
    </Flex>
  );
}

/**
 * User cell component for "Created By" column
 */
function UserCell({ user }: { user: DataRow["user"] }) {
  if (!user) {
    return <Text color="text-700">—</Text>;
  }
  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <UserPicture
        name={user.username}
        profilePictureUrl={user.profilePictureUrl ?? null}
        size={20}
      />
      <span>{user.username}</span>
    </Flex>
  );
}

/**
 * Empty state component for when no providers are configured
 */
function EmptyState() {
  return (
    <View padding="size-200">
      <Flex
        direction="column"
        gap="size-100"
        alignItems="center"
        justifyContent="center"
      >
        <Icon svg={<Icons.PlusOutline />} />
        <Text color="text-700">No custom providers configured yet.</Text>
        <Text size="XS" color="text-700">
          Create a custom provider to connect to your own model endpoints.
        </Text>
      </Flex>
    </View>
  );
}

export function CustomProvidersCard({
  query,
}: {
  query: CustomProvidersCard_data$key;
}) {
  const { authenticationEnabled } = useFunctionality();
  const data = useFragment<CustomProvidersCard_data$key>(
    graphql`
      fragment CustomProvidersCard_data on Query
      @refetchable(queryName: "CustomProvidersCardQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 50 }
      ) {
        generativeModelCustomProviders(first: $first, after: $after)
          @connection(
            key: "CustomProvidersCard_generativeModelCustomProviders"
          ) {
          edges {
            node {
              id
              name
              description
              sdk
              provider
              createdAt
              updatedAt
              user {
                id
                username
                profilePictureUrl
              }
              ... on GenerativeModelCustomProviderOpenAI {
                config {
                  ... on UnparsableConfig {
                    parseError
                  }
                  ... on OpenAICustomProviderConfig {
                    openaiAuthenticationMethod {
                      apiKey
                    }
                    openaiClientKwargs {
                      baseUrl
                      organization
                      project
                      defaultHeaders
                    }
                  }
                }
              }
              ... on GenerativeModelCustomProviderAzureOpenAI {
                config {
                  ... on UnparsableConfig {
                    parseError
                  }
                  ... on AzureOpenAICustomProviderConfig {
                    azureOpenaiAuthenticationMethod {
                      apiKey
                      azureAdTokenProvider {
                        azureTenantId
                        azureClientId
                        azureClientSecret
                        scope
                      }
                    }
                    azureOpenaiClientKwargs {
                      apiVersion
                      azureEndpoint
                      azureDeployment
                      defaultHeaders
                    }
                  }
                }
              }
              ... on GenerativeModelCustomProviderAnthropic {
                config {
                  ... on UnparsableConfig {
                    parseError
                  }
                  ... on AnthropicCustomProviderConfig {
                    anthropicAuthenticationMethod {
                      apiKey
                    }
                    anthropicClientKwargs {
                      baseUrl
                      defaultHeaders
                    }
                  }
                }
              }
              ... on GenerativeModelCustomProviderAWSBedrock {
                config {
                  ... on UnparsableConfig {
                    parseError
                  }
                  ... on AWSBedrockCustomProviderConfig {
                    awsBedrockAuthenticationMethod {
                      awsAccessKeyId
                      awsSecretAccessKey
                      awsSessionToken
                    }
                    awsBedrockClientKwargs {
                      regionName
                      endpointUrl
                    }
                  }
                }
              }
              ... on GenerativeModelCustomProviderGoogleGenAI {
                config {
                  ... on UnparsableConfig {
                    parseError
                  }
                  ... on GoogleGenAICustomProviderConfig {
                    googleGenaiAuthenticationMethod {
                      apiKey
                    }
                    googleGenaiClientKwargs {
                      httpOptions {
                        baseUrl
                        headers
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    query
  );

  const tableData = useMemo(
    () => data.generativeModelCustomProviders.edges.map((edge) => edge.node),
    [data.generativeModelCustomProviders.edges]
  );

  // Define columns with memoization and proper typing
  const columns = useMemo<ColumnDef<DataRow>[]>(() => {
    const cols: ColumnDef<DataRow>[] = [
      {
        header: "Name",
        accessorKey: "name",
      },
      {
        header: "Description",
        accessorKey: "description",
        cell: ({ getValue }) => {
          const value = getValue<string | null>();
          return (
            <Text color={value ? undefined : "text-700"}>{value || "—"}</Text>
          );
        },
      },
      {
        header: "Provider",
        accessorFn: (row) => row.provider ?? undefined,
        sortUndefined: "last",
        cell: ({ row }) => (
          <ProviderCell
            provider={row.original.provider}
            sdk={row.original.sdk}
          />
        ),
      },
    ];

    // Add "Created By" column only if authentication is enabled
    if (authenticationEnabled) {
      cols.push({
        header: "Created By",
        accessorKey: "user",
        cell: ({ row }) => <UserCell user={row.original.user} />,
      });
    }

    cols.push(
      {
        header: "Created At",
        accessorKey: "createdAt",
        cell: TimestampCell,
      },
      {
        header: "Updated At",
        accessorKey: "updatedAt",
        cell: TimestampCell,
      },
      {
        header: "",
        accessorKey: "id",
        size: 10,
        enableSorting: false,
        cell: ({ row }) => <ActionsCell row={row.original} />,
      }
    );

    return cols;
  }, [authenticationEnabled]);

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
    <ErrorBoundary>
      <Card title="Custom Model Providers" extra={<NewProviderButton />}>
        {isEmpty ? (
          <EmptyState />
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
              {rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </ErrorBoundary>
  );
}
