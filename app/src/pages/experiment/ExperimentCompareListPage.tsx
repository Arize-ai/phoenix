import { useCallback, useMemo, useRef } from "react";
import { graphql, useFragment, usePaginationFragment } from "react-relay";
import { useLoaderData, useSearchParams } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Getter,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Text, View } from "@phoenix/components";

import type {
  ExperimentCompareListPage_aggregateData$data,
  ExperimentCompareListPage_aggregateData$key,
} from "./__generated__/ExperimentCompareListPage_aggregateData.graphql";
import type {
  ExperimentCompareListPage_comparisons$data,
  ExperimentCompareListPage_comparisons$key,
} from "./__generated__/ExperimentCompareListPage_comparisons.graphql";
import type { ExperimentCompareListPageQuery } from "./__generated__/ExperimentCompareListPageQuery.graphql";
import type { experimentCompareLoader } from "./experimentCompareLoader";

const PAGE_SIZE = 50;

type ExperimentRun =
  ExperimentCompareListPage_comparisons$data["compareExperiments"]["edges"][number]["comparison"]["runComparisonItems"][number]["runs"][number];

type Experiment = NonNullable<
  ExperimentCompareListPage_aggregateData$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type TableRow = {
  id: string;
  example: string;
  input: string;
  referenceOutput: string;
  outputs: {
    baseExperimentValue: string;
    compareExperimentValues: string[];
  };
  tokens: {
    baseExperimentValue: number;
    compareExperimentValues: (number | null | undefined)[];
  };
  latency: {
    baseExperimentValue: number;
    compareExperimentValues: (number | null | undefined)[];
  };
  cost: {
    baseExperimentValue: number;
    compareExperimentValues: (number | null | undefined)[];
  };
  annotations: {
    baseExperimentValue: { name: string; score: number | null }[];
    compareExperimentValues: { name: string; score: number | null }[][];
  };
};

export function ExperimentCompareListPage() {
  const [searchParams] = useSearchParams();
  const experimentIds = searchParams.getAll("experimentId");

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loaderData = useLoaderData<typeof experimentCompareLoader>();

  const aggregateData =
    useFragment<ExperimentCompareListPage_aggregateData$key>(
      graphql`
        fragment ExperimentCompareListPage_aggregateData on Query
        @argumentDefinitions(
          datasetId: { type: "ID!" }
          experimentIds: { type: "[ID!]!" }
        ) {
          dataset: node(id: $datasetId) {
            ... on Dataset {
              experiments(filterIds: $experimentIds) {
                edges {
                  experiment: node {
                    id
                    averageRunLatencyMs
                    costSummary {
                      total {
                        tokens
                        cost
                      }
                    }
                    annotationSummaries {
                      annotationName
                      meanScore
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
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
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

  const experiments = useMemo(() => {
    const experimentsById: Record<string, Experiment> = {};
    aggregateData?.dataset.experiments?.edges.forEach((edge) => {
      experimentsById[edge.experiment.id] = edge.experiment;
    });
    const orderedExperiments = experimentIds.map(
      (experimentId) => experimentsById[experimentId]
    );
    return orderedExperiments;
  }, [aggregateData?.dataset.experiments?.edges, experimentIds]);

  const annotationSummaries = useMemo(() => {
    const baseExperiment =
      aggregateData?.dataset.experiments?.edges[0]?.experiment;
    return baseExperiment?.annotationSummaries ?? [];
  }, [aggregateData?.dataset.experiments?.edges]);

  const tableData: TableRow[] = useMemo(() => {
    return (
      data?.compareExperiments.edges.map((edge) => {
        const comparison = edge.comparison;
        const example = comparison.example;
        const runItems = comparison.runComparisonItems;

        const baseExperimentRun: ExperimentRun = runItems[0].runs[0];
        const compareExperimentRuns: (ExperimentRun | undefined)[] = runItems
          .slice(1)
          .map((item) => item.runs[0]);
        const tableData = {
          id: example.id,
          example: example.id,
          input: example.revision.input,
          referenceOutput: example.revision.referenceOutput,
          outputs: {
            baseExperimentValue: baseExperimentRun.output,
            compareExperimentValues: compareExperimentRuns.map((run) =>
              run ? run.output : "not run"
            ),
          },
          tokens: {
            baseExperimentValue:
              baseExperimentRun.costSummary.total.tokens ?? 0,
            compareExperimentValues: compareExperimentRuns.map(
              (run) => run?.costSummary.total.tokens ?? 0
            ),
          },
          latency: {
            baseExperimentValue:
              (new Date(baseExperimentRun.endTime).getTime() -
                new Date(baseExperimentRun.startTime).getTime()) /
              1000,
            compareExperimentValues: compareExperimentRuns.map((run) =>
              run
                ? (new Date(run.endTime).getTime() -
                    new Date(run.startTime).getTime()) /
                  1000
                : undefined
            ),
          },
          cost: {
            baseExperimentValue: baseExperimentRun.costSummary.total.cost ?? 0,
            compareExperimentValues: compareExperimentRuns.map(
              (run) => run?.costSummary.total.cost
            ),
          },
          annotations: {
            baseExperimentValue: baseExperimentRun.annotations.edges.map(
              (edge) => ({
                name: edge.annotation.name,
                score: edge.annotation.score,
              })
            ),
            compareExperimentValues: compareExperimentRuns.map(
              (run) =>
                run?.annotations.edges.map((edge) => ({
                  name: edge.annotation.name,
                  score: edge.annotation.score,
                })) ?? []
            ),
          },
        };
        return tableData;
      }) ?? []
    );
  }, [data]);

  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        //once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isLoadingNext &&
          hasNext
        ) {
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

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
        header: "Output",
        accessorKey: "outputs",
        cell: ({ getValue }) => {
          const value = getValue() as TableRow["outputs"];
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
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              `}
            >
              <li>
                <Text size="S">
                  {JSON.stringify(value.baseExperimentValue)}
                </Text>
              </li>
              {value.compareExperimentValues.map((value, index) => (
                <li key={index}>
                  <Text size="S">{JSON.stringify(value)}</Text>
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
              {experiments.map((experiment) => {
                return (
                  <li key={experiment.id}>
                    <Text size="S">{experiment.costSummary.total.tokens}</Text>
                  </li>
                );
              })}
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
              {experiments.map((experiment) => (
                <li key={experiment.id}>
                  <Text size="S">
                    {((experiment.averageRunLatencyMs ?? 0) / 1000).toFixed(2)}s
                  </Text>
                </li>
              ))}
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
                  <Text size="S">{value?.toFixed(2) ?? "--"}s</Text>
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
              {experiments.map((experiment) => (
                <li key={experiment.id}>
                  <Text size="S">
                    ${experiment.costSummary.total.cost?.toFixed(3)}
                  </Text>
                </li>
              ))}
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
                  <Text size="S">${value?.toFixed(3) ?? "--"}</Text>
                </li>
              ))}
            </ul>
          );
        },
      },
      ...(annotationSummaries.map((annotationSummary) => ({
        header: () => (
          <div>
            <Text size="S" weight="heavy">
              {annotationSummary.annotationName}
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
              {experiments.map((experiment) => (
                <li key={experiment.id}>
                  <Text size="S">
                    {experiment.annotationSummaries
                      ?.find(
                        (summary) =>
                          summary.annotationName ===
                          annotationSummary.annotationName
                      )
                      ?.meanScore?.toFixed(3) ?? "N/A"}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        ),
        accessorKey: "annotations",
        cell: ({ getValue }: { getValue: Getter<TableRow["annotations"]> }) => {
          const annotations = getValue();

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
                <Text size="S">
                  {(() => {
                    const score = annotations.baseExperimentValue.find(
                      (annotation) =>
                        annotation.name === annotationSummary.annotationName
                    )?.score;
                    return score?.toFixed(3) ?? "N/A";
                  })()}
                </Text>
              </li>
              {annotations.compareExperimentValues.map((values, index) => (
                <li key={index}>
                  <Text size="S">
                    {(() => {
                      const score = values.find(
                        (annotation) =>
                          annotation.name === annotationSummary.annotationName
                      )?.score;
                      return score?.toFixed(3) ?? "N/A";
                    })()}
                  </Text>
                </li>
              ))}
            </ul>
          );
        },
      })) ?? []),
    ],
    [annotationSummaries, experiments]
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
      <div
        css={css`
          flex: 1 1 auto;
          overflow: auto;
          height: 100%;
        `}
        onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
        ref={tableContainerRef}
      >
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
      </div>
    </View>
  );
}
