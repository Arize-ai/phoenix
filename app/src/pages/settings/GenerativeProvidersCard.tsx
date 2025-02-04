import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Card } from "@arizeai/components";

import { Flex } from "@phoenix/components";
import {
  GenerativeProviderIcon,
  GenerativeProviderIconProps,
} from "@phoenix/components/generative";
import { tableCSS } from "@phoenix/components/table/styles";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  GenerativeProvidersCard_data$data,
  GenerativeProvidersCard_data$key,
} from "./__generated__/GenerativeProvidersCard_data.graphql";

type ProviderKey =
  GenerativeProvidersCard_data$data["modelProviders"][number]["key"];

function ProviderIcon({ providerKey }: { providerKey: ProviderKey }) {
  let provider: GenerativeProviderIconProps["provider"];
  switch (providerKey) {
    case "OPENAI":
      provider = "OPENAI";
      break;
    case "ANTHROPIC":
      provider = "ANTHROPIC";
      break;
    case "GEMINI":
      provider = "GEMINI";
      break;
    case "AZURE_OPENAI":
      provider = "AZURE_OPENAI";
      break;
    default:
      assertUnreachable(providerKey);
  }
  return <GenerativeProviderIcon provider={provider} height={18} />;
}
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
          apiKeyEnvVar
          apiKeySet
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
              <ProviderIcon providerKey={row.original.key} />
              {row.original.name}
            </Flex>
          );
        },
      },

      {
        header: "configuration",
        accessorKey: "apiKeySet",
        cell: ({ row }) => {
          if (!row.original.dependenciesInstalled) {
            return "missing deps";
          }
          if (row.original.apiKeySet) {
            return "configured on the server";
          }
          return "not configured";
        },
      },
    ] satisfies ColumnDef<DataRow>[];
  }, []);

  const table = useReactTable<(typeof tableData)[number]>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <Card title="AI Providers" bodyStyle={{ padding: 0 }} variant="compact">
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
