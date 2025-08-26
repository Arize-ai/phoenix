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

import {
  ColorSwatch,
  Flex,
  ProgressBar,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
import { JSONText } from "@phoenix/components/code/JSONText";
import { useExperimentColors } from "@phoenix/components/experiment";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import {
  costFormatter,
  intFormatter,
  latencyMsFormatter,
  numberFormatter,
} from "@phoenix/utils/numberFormatUtils";

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
import { calculateAnnotationScorePercentile } from "./utils";

const PAGE_SIZE = 50;

const tableWrapCSS = css`
  flex: 1 1 auto;
  overflow: auto;
  // Make sure the table fills up the remaining space
  table {
    min-width: 100%;
    td {
      vertical-align: top;
    }
  }
`;

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
    baseExperimentValue: number | null;
    compareExperimentValues: (number | null | undefined)[];
  };
  latencyMs: {
    baseExperimentValue: number;
    compareExperimentValues: (number | null | undefined)[];
  };
  cost: {
    baseExperimentValue: number | null;
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

  const { getExperimentColor, baseExperimentColor } = useExperimentColors();

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
              experimentAnnotationSummaries {
                annotationName
                minScore
                maxScore
              }
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
                  output
                  startTime
                  endTime
                  costSummary {
                    total {
                      tokens
                      cost
                    }
                  }
                  annotations {
                    edges {
                      annotation: node {
                        name
                        score
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
    return aggregateData?.dataset.experimentAnnotationSummaries?.filter(
      (summary) =>
        baseExperiment?.annotationSummaries?.some(
          (annotation) => annotation.annotationName === summary.annotationName
        )
    );
  }, [aggregateData?.dataset]);

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
            baseExperimentValue: baseExperimentRun.costSummary.total.tokens,
            compareExperimentValues: compareExperimentRuns.map(
              (run) => run?.costSummary.total.tokens
            ),
          },
          latencyMs: {
            baseExperimentValue:
              new Date(baseExperimentRun.endTime).getTime() -
              new Date(baseExperimentRun.startTime).getTime(),
            compareExperimentValues: compareExperimentRuns.map((run) =>
              run
                ? new Date(run.endTime).getTime() -
                  new Date(run.startTime).getTime()
                : undefined
            ),
          },
          cost: {
            baseExperimentValue: baseExperimentRun.costSummary.total.cost,
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
        header: "example",
        accessorKey: "example",
        cell: ({ getValue }) => <Text size="S">{getValue() as string}</Text>,
      },
      {
        header: "input",
        accessorKey: "input",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return (
            <Text size="S" color="text-500">
              <JSONText json={value} />
            </Text>
          );
        },
      },
      {
        header: "reference output",
        accessorKey: "referenceOutput",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return (
            <Text size="S" color="text-500">
              <JSONText json={value} />
            </Text>
          );
        },
      },
      {
        header: "output",
        accessorKey: "outputs",
        cell: ({ getValue }) => {
          const value = getValue() as TableRow["outputs"];
          return (
            <ul
              css={css`
                max-width: 200px;
                overflow: hidden;
                white-space: nowrap;
              `}
            >
              <li
                css={css`
                  margin-bottom: var(--ac-global-dimension-size-175);
                `}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ColorSwatch color={baseExperimentColor} shape="circle" />
                  <Text
                    size="S"
                    css={css`
                      flex: 1;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    `}
                  >
                    <JSONText
                      json={value.baseExperimentValue}
                      maxLength={100}
                    />
                  </Text>
                </Flex>
              </li>
              {value.compareExperimentValues.map((value, index) => (
                <li
                  key={index}
                  css={css`
                    margin-bottom: var(--ac-global-dimension-size-175);
                  `}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <ColorSwatch
                      color={getExperimentColor(index)}
                      shape="circle"
                    />
                    <Text
                      size="S"
                      css={css`
                        flex: 1;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      `}
                    >
                      <JSONText json={value} maxLength={100} />
                    </Text>
                  </Flex>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        header: () => (
          <Flex direction="column" gap="size-100">
            <Text size="S" weight="heavy">
              tokens
            </Text>
            <ul>
              {experiments.map((experiment, index) => {
                return (
                  <li
                    key={experiment.id}
                    css={css`
                      margin-bottom: var(--ac-global-dimension-size-175);
                    `}
                  >
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <ColorSwatch
                        color={
                          index === 0
                            ? baseExperimentColor
                            : getExperimentColor(index - 1)
                        }
                        shape="circle"
                      />
                      <Text size="S">
                        {intFormatter(experiment.costSummary.total.tokens)}
                      </Text>
                    </Flex>
                  </li>
                );
              })}
            </ul>
          </Flex>
        ),
        accessorKey: "tokens",
        cell: ({ getValue }) => {
          const tokens = getValue() as TableRow["tokens"];
          return (
            <ul>
              <li
                css={css`
                  margin-bottom: var(--ac-global-dimension-size-175);
                `}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ColorSwatch color={baseExperimentColor} shape="circle" />
                  <Text size="S">
                    {intFormatter(tokens.baseExperimentValue)}
                  </Text>
                </Flex>
              </li>
              {tokens.compareExperimentValues.map((value, index) => (
                <li
                  key={index}
                  css={css`
                    margin-bottom: var(--ac-global-dimension-size-175);
                  `}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <ColorSwatch
                      color={getExperimentColor(index)}
                      shape="circle"
                    />
                    <Text size="S">{intFormatter(value)}</Text>
                  </Flex>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        header: () => (
          <Flex direction="column" gap="size-100">
            <Text size="S" weight="heavy">
              latency
            </Text>
            <ul>
              {experiments.map((experiment, index) => (
                <li
                  key={experiment.id}
                  css={css`
                    margin-bottom: var(--ac-global-dimension-size-175);
                  `}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <ColorSwatch
                      color={
                        index === 0
                          ? baseExperimentColor
                          : getExperimentColor(index - 1)
                      }
                      shape="circle"
                    />
                    <Text size="S">
                      {latencyMsFormatter(experiment.averageRunLatencyMs)}
                    </Text>
                  </Flex>
                </li>
              ))}
            </ul>
          </Flex>
        ),
        accessorKey: "latencyMs",
        cell: ({ getValue }) => {
          const latencyMs = getValue() as TableRow["latencyMs"];
          return (
            <ul>
              <li
                css={css`
                  margin-bottom: var(--ac-global-dimension-size-175);
                `}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ColorSwatch color={baseExperimentColor} shape="circle" />
                  <Text size="S">
                    {latencyMsFormatter(latencyMs.baseExperimentValue)}
                  </Text>
                </Flex>
              </li>
              {latencyMs.compareExperimentValues.map((value, index) => (
                <li
                  key={index}
                  css={css`
                    margin-bottom: var(--ac-global-dimension-size-175);
                  `}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <ColorSwatch
                      color={getExperimentColor(index)}
                      shape="circle"
                    />
                    <Text size="S">{latencyMsFormatter(value)}</Text>
                  </Flex>
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        header: () => (
          <Flex direction="column" gap="size-100">
            <Text size="S" weight="heavy">
              cost
            </Text>
            <ul>
              {experiments.map((experiment, index) => (
                <li
                  key={experiment.id}
                  css={css`
                    margin-bottom: var(--ac-global-dimension-size-175);
                  `}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <ColorSwatch
                      color={
                        index === 0
                          ? baseExperimentColor
                          : getExperimentColor(index - 1)
                      }
                      shape="circle"
                    />
                    <Text size="S">
                      {costFormatter(experiment.costSummary.total.cost)}
                    </Text>
                  </Flex>
                </li>
              ))}
            </ul>
          </Flex>
        ),
        accessorKey: "cost",
        cell: ({ getValue }) => {
          const cost = getValue() as TableRow["cost"];
          return (
            <ul>
              <li
                css={css`
                  margin-bottom: var(--ac-global-dimension-size-175);
                `}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ColorSwatch color={baseExperimentColor} shape="circle" />
                  <Text size="S">
                    {costFormatter(cost.baseExperimentValue)}
                  </Text>
                </Flex>
              </li>
              {cost.compareExperimentValues.map((value, index) => (
                <li
                  key={index}
                  css={css`
                    margin-bottom: var(--ac-global-dimension-size-175);
                  `}
                >
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <ColorSwatch
                      color={getExperimentColor(index)}
                      shape="circle"
                    />
                    <Text size="S">{costFormatter(value)}</Text>
                  </Flex>
                </li>
              ))}
            </ul>
          );
        },
      },
      ...(annotationSummaries?.map((annotationSummary) => ({
        header: () => (
          <Flex direction="column" gap="size-100">
            <Flex direction="row" gap="size-100" alignItems="center">
              <AnnotationColorSwatch
                annotationName={annotationSummary.annotationName}
              />
              <Text size="S" weight="heavy">
                {annotationSummary.annotationName}
              </Text>
            </Flex>
            <ul>
              {experiments.map((experiment, index) => {
                const experimentAnnotationSummary =
                  experiment.annotationSummaries?.find(
                    (summary) =>
                      summary.annotationName ===
                      annotationSummary.annotationName
                  );
                const color =
                  index === 0
                    ? baseExperimentColor
                    : getExperimentColor(index - 1);
                return (
                  <li
                    key={experiment.id}
                    css={css`
                      --mod-barloader-fill-color: ${color};
                      margin-bottom: var(--ac-global-dimension-size-100);
                    `}
                  >
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <ColorSwatch color={color} shape="circle" />
                      <Text size="S">
                        {numberFormatter(
                          experimentAnnotationSummary?.meanScore
                        )}
                      </Text>
                    </Flex>
                    {typeof experimentAnnotationSummary?.meanScore ===
                      "number" && (
                      <ProgressBar
                        width="100%"
                        value={calculateAnnotationScorePercentile(
                          experimentAnnotationSummary.meanScore,
                          annotationSummary.minScore,
                          annotationSummary.maxScore
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </Flex>
        ),
        accessorKey: "annotations",
        cell: ({ getValue }: { getValue: Getter<TableRow["annotations"]> }) => {
          const annotations = getValue();
          const baseExperimentAnnotationScore = getAnnotationScore(
            annotations.baseExperimentValue,
            annotationSummary.annotationName
          );

          return (
            <ul>
              <li
                css={css`
                  --mod-barloader-fill-color: ${baseExperimentColor};
                  margin-bottom: var(--ac-global-dimension-size-100);
                `}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ColorSwatch color={baseExperimentColor} shape="circle" />
                  <Text size="S">
                    {numberFormatter(baseExperimentAnnotationScore)}
                  </Text>
                </Flex>
                {typeof baseExperimentAnnotationScore === "number" && (
                  <ProgressBar
                    width="100%"
                    value={calculateAnnotationScorePercentile(
                      baseExperimentAnnotationScore,
                      annotationSummary.minScore,
                      annotationSummary.maxScore
                    )}
                  />
                )}
              </li>
              {annotations.compareExperimentValues.map((values, index) => {
                const compareExperimentAnnotationScore = getAnnotationScore(
                  values,
                  annotationSummary.annotationName
                );
                const color = getExperimentColor(index);
                return (
                  <li
                    key={index}
                    css={css`
                      --mod-barloader-fill-color: ${color};
                      margin-bottom: var(--ac-global-dimension-size-100);
                    `}
                  >
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <ColorSwatch color={color} shape="circle" />
                      <Text size="S">
                        {numberFormatter(
                          getAnnotationScore(
                            values,
                            annotationSummary.annotationName
                          )
                        )}
                      </Text>
                    </Flex>
                    {typeof compareExperimentAnnotationScore === "number" && (
                      <ProgressBar
                        width="100%"
                        value={calculateAnnotationScorePercentile(
                          compareExperimentAnnotationScore,
                          annotationSummary.minScore,
                          annotationSummary.maxScore
                        )}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          );
        },
      })) ?? []),
    ],
    [annotationSummaries, experiments, getExperimentColor, baseExperimentColor]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <View overflow="auto">
      <Flex direction="column" height="100%">
        <div
          css={tableWrapCSS}
          onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
          ref={tableContainerRef}
        >
          <table
            css={css(tableCSS, borderedTableCSS)}
            style={{
              width: table.getTotalSize(),
              minWidth: "100%",
            }}
          >
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
        </div>
      </Flex>
    </View>
  );
}

const getAnnotationScore = (
  values: { name: string; score: number | null }[],
  annotationName: string
) => {
  const score = values.find(
    (annotation) => annotation.name === annotationName
  )?.score;
  return score;
};
