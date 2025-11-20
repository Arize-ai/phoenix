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
  CustomProvidersCard_data$key,
  GenerativeModelCustomProviderSDK,
} from "./__generated__/CustomProvidersCard_data.graphql";
import { DeleteProviderButton } from "./DeleteCustomProviderButton";
import { EditProviderButton } from "./EditCustomProviderButton";
import { NewProviderButton } from "./NewCustomProviderButton";

/**
 * Mapping from SDK enum to ModelProvider key
 */
const SDK_TO_PROVIDER_MAP: Record<
  GenerativeModelCustomProviderSDK,
  ModelProvider
> = {
  OPENAI: "OPENAI",
  AZURE_OPENAI: "AZURE_OPENAI",
  ANTHROPIC: "ANTHROPIC",
  AWS_BEDROCK: "AWS",
  GOOGLE_GENAI: "GOOGLE",
};

/**
 * Resolves provider information from provider string and SDK.
 * Returns the ModelProvider key and display text.
 * Priority: provider string match > SDK fallback > raw provider string
 */
function resolveProviderDisplay(
  providerString: string,
  sdk: GenerativeModelCustomProviderSDK
): { providerKey: ModelProvider; displayText: string } {
  // Normalize provider string for matching
  const normalized = providerString.toLowerCase().replace(/[_-]/g, "");

  // Attempt to match provider string to known providers
  const stringToProviderMap: Record<string, ModelProvider> = {
    openai: "OPENAI",
    azure: "AZURE_OPENAI",
    azureopenai: "AZURE_OPENAI",
    anthropic: "ANTHROPIC",
    aws: "AWS",
    google: "GOOGLE",
    xai: "XAI",
    ollama: "OLLAMA",
    deepseek: "DEEPSEEK",
  };

  const matchedProvider = stringToProviderMap[normalized];

  if (matchedProvider) {
    // Provider string matched a known provider
    return {
      providerKey: matchedProvider,
      displayText: getProviderName(matchedProvider),
    };
  }

  // Fall back to SDK mapping
  const providerKey = SDK_TO_PROVIDER_MAP[sdk];

  // Use raw provider string if available and didn't match, otherwise use provider name
  const displayText = providerString
    ? providerString
    : getProviderName(providerKey);

  return { providerKey, displayText };
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
                      apiKey {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                    }
                    openaiClientKwargs {
                      baseUrl {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      organization {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      project {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
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
                      apiKey {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      azureAdToken {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      azureAdTokenProvider {
                        azureTenantId {
                          ... on StringValue {
                            stringValue
                          }
                          ... on StringValueLookup {
                            stringValueLookupKey
                          }
                        }
                        azureClientId {
                          ... on StringValue {
                            stringValue
                          }
                          ... on StringValueLookup {
                            stringValueLookupKey
                          }
                        }
                        azureClientSecret {
                          ... on StringValue {
                            stringValue
                          }
                          ... on StringValueLookup {
                            stringValueLookupKey
                          }
                        }
                        scope {
                          ... on StringValue {
                            stringValue
                          }
                          ... on StringValueLookup {
                            stringValueLookupKey
                          }
                        }
                      }
                    }
                    azureOpenaiClientKwargs {
                      apiVersion {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      azureEndpoint {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      azureDeployment {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
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
                      apiKey {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                    }
                    anthropicClientKwargs {
                      baseUrl {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
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
                      awsAccessKeyId {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      awsSecretAccessKey {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      awsSessionToken {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                    }
                    awsBedrockClientKwargs {
                      regionName {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
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
                      apiKey {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                    }
                    googleGenaiClientKwargs {
                      httpOptions {
                        baseUrl {
                          ... on StringValue {
                            stringValue
                          }
                          ... on StringValueLookup {
                            stringValueLookupKey
                          }
                        }
                        headers
                      }
                    }
                  }
                }
              }
              ... on GenerativeModelCustomProviderDeepSeek {
                config {
                  ... on UnparsableConfig {
                    parseError
                  }
                  ... on DeepSeekCustomProviderConfig {
                    deepseekAuthenticationMethod {
                      apiKey {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                    }
                    openaiClientKwargs {
                      baseUrl {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      organization {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      project {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      defaultHeaders
                    }
                  }
                }
              }
              ... on GenerativeModelCustomProviderOllama {
                config {
                  ... on UnparsableConfig {
                    parseError
                  }
                  ... on OllamaCustomProviderConfig {
                    openaiClientKwargs {
                      baseUrl {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      organization {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      project {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      defaultHeaders
                    }
                  }
                }
              }
              ... on GenerativeModelCustomProviderXAI {
                config {
                  ... on UnparsableConfig {
                    parseError
                  }
                  ... on XAICustomProviderConfig {
                    xaiAuthenticationMethod {
                      apiKey {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                    }
                    openaiClientKwargs {
                      baseUrl {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      organization {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      project {
                        ... on StringValue {
                          stringValue
                        }
                        ... on StringValueLookup {
                          stringValueLookupKey
                        }
                      }
                      defaultHeaders
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

  type DataRow = (typeof tableData)[number];
  const columns = useMemo(() => {
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
        cell: ({ row }) => {
          const { provider, sdk } = row.original;
          const { providerKey, displayText } = resolveProviderDisplay(
            provider,
            sdk
          );

          return (
            <Flex direction="row" gap="size-100" alignItems="center">
              <GenerativeProviderIcon provider={providerKey} height={18} />
              <span>{displayText}</span>
            </Flex>
          );
        },
      },
    ];

    // Add "Created By" column only if authentication is enabled
    if (authenticationEnabled) {
      cols.push({
        header: "Created By",
        accessorKey: "user",
        cell: ({ row }) => {
          const user = row.original.user;
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
        },
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
        cell: ({ row }) => {
          const parseError =
            (
              row.original as {
                config?: { parseError?: string | null };
              }
            ).config?.parseError ?? undefined;
          return (
            <Flex
              direction="row"
              justifyContent="end"
              gap="size-50"
              width="100%"
            >
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
                <EditProviderButton provider={row.original} />
              )}
              <DeleteProviderButton provider={row.original} />
            </Flex>
          );
        },
      }
    );

    return cols;
  }, [authenticationEnabled]);

  const table = useReactTable<DataRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <Card title="Custom Model Providers" extra={<NewProviderButton />}>
      {isEmpty ? (
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
