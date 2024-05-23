import React, { Suspense, useMemo } from "react";
import { graphql, useRefetchableFragment } from "react-relay";
import { useLoaderData } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Flex, Text, View } from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { TextCell } from "@phoenix/components/table/TextCell";

import type {
  datasetLoaderQuery,
  datasetLoaderQuery$data,
} from "./__generated__/datasetLoaderQuery.graphql";
import type { DatasetPageExamplesFragment$key } from "./__generated__/DatasetPageExamplesFragment.graphql";

export function DatasetPage() {
  const loaderData = useLoaderData() as datasetLoaderQuery$data;
  return (
    <Suspense fallback={<Loading />}>
      <DatasetPageContent dataset={loaderData["dataset"]} />
    </Suspense>
  );
}

function DatasetPageContent({
  dataset,
}: {
  dataset: datasetLoaderQuery$data["dataset"];
}) {
  const [data] = useRefetchableFragment<
    datasetLoaderQuery,
    DatasetPageExamplesFragment$key
  >(
    graphql`
      fragment DatasetPageExamplesFragment on Dataset
      @refetchable(queryName: "DatasetPageExamplesQuery") {
        examples {
          edges {
            node {
              id
              input
              output
              metadata
            }
          }
        }
      }
    `,
    dataset
  );
  const tableData = useMemo(
    () =>
      data.examples.edges.map((edge) => {
        const { id, input, output, metadata } = edge.node;
        return {
          id,
          input: JSON.stringify(input),
          output: JSON.stringify(output),
          metadata: JSON.stringify(metadata),
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "id",
      accessorKey: "id",
      cell: TextCell,
    },
    {
      header: "input",
      accessorKey: "input",
      cell: TextCell,
    },
    {
      header: "output",
      accessorKey: "output",
      cell: TextCell,
    },
    {
      header: "metadata",
      accessorKey: "metadata",
      cell: TextCell,
    },
  ];
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  return (
    <div>
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="dark"
      >
        <Flex direction="row" justifyContent="space-between">
          <Flex direction="column" justifyContent="space-between">
            <Text elementType="h1" textSize="xlarge" weight="heavy">
              {dataset.name}
            </Text>
            <Text color="text-700">{dataset.description || "--"}</Text>
          </Flex>
        </Flex>
      </View>
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  <div>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmpty />
        ) : (
          <tbody>
            {rows.map((row) => (
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
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}
