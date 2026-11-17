import { flexRender, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Card,
  DocumentationHelp,
  Flex,
  Link,
  MarkerTrigger,
  StatusIndicator,
  Text,
  View,
} from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { ErrorBoundary } from "@phoenix/components/exception";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { tableCSS } from "@phoenix/components/table/styles";
import type { ColumnDef } from "@phoenix/components/table/tableFeatures";
import { appTableFeatures } from "@phoenix/components/table/tableFeatures";
import {
  type GenerativeModelSDK,
  SDK_LABELS,
} from "@phoenix/constants/generativeConstants";

import type {
  CustomProvidersCard_data$data,
  CustomProvidersCard_data$key,
  GenerativeModelSDK as GraphQLGenerativeModelSDK,
} from "./__generated__/CustomProvidersCard_data.graphql";
import { resolveProviderIconKey } from "./customProviderIcon";
import { DeleteCustomProviderButton } from "./DeleteCustomProviderButton";
import { EditCustomProviderButton } from "./EditCustomProviderButton";
import { formatModelTypes } from "./modelTypeUtils";
import { NewCustomProviderButton } from "./NewCustomProviderButton";

// Compile-time check that GenerativeModelSDK in generativeConstants.ts matches the GraphQL schema.
// This will cause a TypeScript error if the types diverge.
type _AssertSDKTypesMatch = GraphQLGenerativeModelSDK extends GenerativeModelSDK
  ? GenerativeModelSDK extends GraphQLGenerativeModelSDK
    ? true
    : "GenerativeModelSDK in generativeConstants.ts is missing values from GraphQL schema"
  : "GraphQL schema has new SDK values not in generativeConstants.ts";
const _assertSDKTypesMatch: _AssertSDKTypesMatch = true;
void _assertSDKTypesMatch; // Prevent unused variable warning

// Type alias for row data
type DataRow =
  CustomProvidersCard_data$data["generativeModelCustomProviders"]["edges"][number]["node"];

/**
 * Name cell component - the provider icon before a link to the provider's
 * details, and a status if the config has a parse error
 */
function NameCell({
  id,
  name,
  providerString,
  sdk,
  hasParseError,
}: {
  id: string;
  name: string;
  providerString: string;
  sdk: GenerativeModelSDK;
  hasParseError: boolean;
}) {
  const providerKey = useMemo(
    () => resolveProviderIconKey({ providerString, sdk }),
    [providerString, sdk]
  );
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <GenerativeProviderIcon provider={providerKey} height={18} />
      <Link to={`/settings/providers/custom/${encodeURIComponent(id)}`}>
        {name}
      </Link>
      {hasParseError ? (
        <MarkerTrigger
          explanation={
            <>
              This provider&apos;s configuration could not be parsed. Use edit
              to enter a new configuration.
            </>
          }
        >
          <StatusIndicator category="failed" label="Invalid configuration" />
        </MarkerTrigger>
      ) : null}
    </Flex>
  );
}

export function CustomProvidersCard({
  query,
}: {
  query: CustomProvidersCard_data$key;
}) {
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
              sdk
              provider
              modelTypes
              # Only fetch parseError to detect unparseable configs; the details
              # drawer and EditCustomProviderButton fetch the full config
              config {
                ... on UnparsableConfig {
                  parseError
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
    return [
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <NameCell
            id={row.original.id}
            name={row.original.name}
            providerString={row.original.provider}
            sdk={row.original.sdk}
            hasParseError={Boolean(row.original.config?.parseError)}
          />
        ),
      },
      {
        header: "Model Types",
        accessorKey: "modelTypes",
        cell: ({ row }) => (
          <Text>{formatModelTypes(row.original.modelTypes)}</Text>
        ),
      },
      {
        header: "Provider",
        accessorFn: (row) => row.provider ?? undefined,
        sortUndefined: "last",
        cell: ({ row }) => <Text>{row.original.provider}</Text>,
      },
      {
        header: "SDK",
        accessorKey: "sdk",
        cell: ({ row }) => <Text>{SDK_LABELS[row.original.sdk]}</Text>,
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Flex direction="row" gap="size-50" width="100%" justifyContent="end">
            <EditCustomProviderButton
              providerId={row.original.id}
              providerName={row.original.name}
            />
            <DeleteCustomProviderButton
              providerId={row.original.id}
              providerName={row.original.name}
            />
          </Flex>
        ),
      },
    ];
  }, []);

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: tableData,
  });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;

  return (
    <ErrorBoundary>
      <Card
        title="Custom AI Providers"
        titleExtra={
          <DocumentationHelp topic="customAiProviders">
            Create shared provider credentials and routing configurations for
            the Playground and saved prompts.
          </DocumentationHelp>
        }
        extra={<NewCustomProviderButton />}
      >
        {isEmpty ? (
          <View padding="size-500">
            <EmptyState
              graphic={<EmptyStateGraphic variant="customAIProvider" />}
              description="No custom AI providers configured yet."
            />
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
