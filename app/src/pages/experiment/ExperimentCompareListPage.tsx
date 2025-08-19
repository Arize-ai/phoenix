import { useMemo } from "react";
import { graphql, usePaginationFragment } from "react-relay";
import { useLoaderData } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Text, View } from "@phoenix/components";

import type { ExperimentCompareListPage_comparisons$key } from "./__generated__/ExperimentCompareListPage_comparisons.graphql";
import type { ExperimentCompareListPageQuery } from "./__generated__/ExperimentCompareListPageQuery.graphql";
import type { experimentCompareLoader } from "./experimentCompareLoader";

type TableRow = {
  id: string;
  example: string;
  input: string;
  referenceOutput: string;
  tokens: {
    baseExperimentValue: number;
    compareExperimentValues: number[];
  };
  latency: {
    baseExperimentValue: number;
    compareExperimentValues: number[];
  };
  cost: {
    baseExperimentValue: number;
    compareExperimentValues: number[];
  };
};

export function ExperimentCompareListPage() {
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  const { data } = usePaginationFragment<
    ExperimentCompareListPageQuery,
    ExperimentCompareListPage_comparisons$key
  >(
    graphql`
      fragment ExperimentCompareListPage_comparisons on Query
      @refetchable(queryName: "ExperimentCompareListPageQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 50 }
        after: { type: "String", defaultValue: null }
        baseExperimentId: { type: "ID!" }
      ) {
        compareExperiments(
          first: $first
          after: $after
          baseExperimentId: $baseExperimentId
          compareExperimentIds: $compareExperimentIds
        ) @connection(key: "ExperimentCompareListPage_compareExperiments") {
          edges {
            comparison: node {
              example {
                id
                revision {
                  input
                  referenceOutput: output
                }
              }
              runComparisonItems {
                experimentId
                runs {
                  id
                  output
                  error
                  startTime
                  endTime
                  trace {
                    traceId
                    projectId
                  }
                  costSummary {
                    total {
                      tokens
                      cost
                    }
                  }
                  annotations {
                    edges {
                      annotation: node {
                        id
                        name
                        score
                        label
                        annotatorKind
                        explanation
                        trace {
                          traceId
                          projectId
                        }
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
    loaderData
  );

  const tableData: TableRow[] = useMemo(() => {
    return (
      data?.compareExperiments.edges.map((edge) => {
        const comparison = edge.comparison;
        const example = comparison.example;
        const runItems = comparison.runComparisonItems;

        const [baseExperimentRun, ...compareExperimentRuns] = runItems.map(
          (item) => item.runs[0]
        );
        const tableData = {
          id: example.id,
          example: example.id,
          input: example.revision.input,
          referenceOutput: example.revision.referenceOutput,
          tokens: {
            baseExperimentValue:
              baseExperimentRun.costSummary.total.tokens ?? 0,
            compareExperimentValues: compareExperimentRuns.map(
              (run) => run.costSummary.total.tokens ?? 0
            ),
          },
          latency: {
            baseExperimentValue:
              (new Date(baseExperimentRun.endTime).getTime() -
                new Date(baseExperimentRun.startTime).getTime()) /
              1000,
            compareExperimentValues: compareExperimentRuns.map(
              (run) =>
                (new Date(run.endTime).getTime() -
                  new Date(run.startTime).getTime()) /
                1000
            ),
          },
          cost: {
            baseExperimentValue: baseExperimentRun.costSummary.total.cost ?? 0,
            compareExperimentValues: compareExperimentRuns.map(
              (run) => run.costSummary.total.cost ?? 0
            ),
          },
        };
        return tableData;
      }) ?? []
    );
  }, [data]);

  const columns: ColumnDef<TableRow>[] = useMemo(
    () => [
      {
        header: "Example",
        accessorKey: "example",
        cell: ({ getValue }) => <Text size="S">{getValue() as string}</Text>,
      },
      {
        header: "Input",
        accessorKey: "input",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return (
            <Text size="S" color="text-500">
              {JSON.stringify(value)}
            </Text>
          );
        },
      },
      {
        header: "Reference Output",
        accessorKey: "referenceOutput",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return (
            <Text size="S" color="text-500">
              {JSON.stringify(value)}
            </Text>
          );
        },
      },
      {
        header: () => (
          <div>
            <Text size="S" weight="heavy">
              Tokens
            </Text>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12px;
                color: var(--ac-global-text-color-600);
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>AVG 401</li>
              <li>AVG 238 ↓</li>
              <li>AVG 1314 ↑</li>
            </ul>
          </div>
        ),
        accessorKey: "tokens",
        cell: ({ getValue }) => {
          const tokens = getValue() as TableRow["tokens"];
          return (
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>
                <Text size="S">{tokens.baseExperimentValue}</Text>
              </li>
              {tokens.compareExperimentValues.map((value, index) => (
                <li key={index}>
                  <Text size="S">{value}</Text>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        header: () => (
          <div>
            <Text size="S" weight="heavy">
              Latency
            </Text>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12px;
                color: var(--ac-global-text-color-600);
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>AVG 1.33s</li>
              <li>AVG 1.49s ↑</li>
              <li>AVG 2.83s ↑</li>
            </ul>
          </div>
        ),
        accessorKey: "latency",
        cell: ({ getValue }) => {
          const latency = getValue() as TableRow["latency"];
          return (
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>
                <Text size="S">{latency.baseExperimentValue.toFixed(2)}s</Text>
              </li>
              {latency.compareExperimentValues.map((value, index) => (
                <li key={index}>
                  <Text size="S">{value.toFixed(2)}s</Text>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        header: () => (
          <div>
            <Text size="S" weight="heavy">
              Cost
            </Text>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12px;
                color: var(--ac-global-text-color-600);
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>AVG $0.004</li>
              <li>AVG $0.032 ↑</li>
              <li>AVG $0.002 ↓</li>
            </ul>
          </div>
        ),
        accessorKey: "cost",
        cell: ({ getValue }) => {
          const cost = getValue() as TableRow["cost"];
          return (
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>
                <Text size="S">${cost.baseExperimentValue.toFixed(3)}</Text>
              </li>
              {cost.compareExperimentValues.map((value, index) => (
                <li key={index}>
                  <Text size="S">${value.toFixed(3)}</Text>
                </li>
              ))}
            </ul>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <View padding="size-200">
      <Text size="L" weight="heavy" marginBottom="size-200">
        Experiment Comparison Table
      </Text>
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
}
