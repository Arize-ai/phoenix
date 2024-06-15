import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Text } from "@arizeai/components";

import { TextCell } from "@phoenix/components/table";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";

import {
  ExperimentCompareTableQuery,
  ExperimentCompareTableQuery$data,
} from "./__generated__/ExperimentCompareTableQuery.graphql";

type ExampleCompareTableProps = {
  baselineExperimentId: string;
  experimentIds: string[];
};

export function ExperimentCompareTable(props: ExampleCompareTableProps) {
  // eslint-disable-next-line prefer-const
  let { baselineExperimentId, experimentIds } = props;
  experimentIds = experimentIds.filter((id) => id !== baselineExperimentId);
  const data = useLazyLoadQuery<ExperimentCompareTableQuery>(
    graphql`
      query ExperimentCompareTableQuery(
        $baselineExperimentId: GlobalID!
        $experimentIds: [GlobalID!]!
      ) {
        comparisons: compareExperiments(
          baselineExperimentId: $baselineExperimentId
          comparisonExperimentIds: $experimentIds
        ) {
          example {
            id
            revision {
              input
              expectedOutput: output
            }
          }
          runComparisonItems {
            experimentId
            runs {
              output
              error
            }
          }
        }
      }
    `,
    {
      baselineExperimentId,
      experimentIds,
    }
  );
  const tableData = useMemo(
    () =>
      data.comparisons.map((comparison) => {
        const runComparisonMap = comparison.runComparisonItems.reduce(
          (acc, item) => {
            acc[item.experimentId] = item;
            return acc;
          },
          {} as Record<
            string,
            ExperimentCompareTableQuery$data["comparisons"][number]["runComparisonItems"][number]
          >
        );
        return {
          ...comparison,
          id: comparison.example.id,
          input: JSON.stringify(comparison.example.revision.input),
          expectedOutput: JSON.stringify(
            comparison.example.revision.expectedOutput
          ),
          runComparisonMap,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];
  const baseColumns: ColumnDef<TableRow>[] = [
    {
      header: "input",
      accessorKey: "input",
      cell: TextCell,
    },
    {
      header: "expected output",
      accessorKey: "expectedOutput",
      cell: TextCell,
    },
  ];

  const experimentColumns: ColumnDef<TableRow>[] = experimentIds.map(
    (experimentId) => ({
      header: `experiment ${experimentId}`,
      accessorKey: experimentId,
      cell: ({ row }) => {
        const runComparisonItem = row.original.runComparisonMap[experimentId];
        return runComparisonItem ? (
          <Text>{JSON.stringify(runComparisonItem)}</Text>
        ) : (
          <Text>{"--"}</Text>
        );
      },
    })
  );
  const table = useReactTable<TableRow>({
    columns: [...baseColumns, ...experimentColumns],
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;

  const isEmpty = rows.length === 0;

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
    >
      <table css={tableCSS}>
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
