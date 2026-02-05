import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  graphql,
  PreloadedQuery,
  useFragment,
  usePaginationFragment,
  usePreloadedQuery,
} from "react-relay";
import { useSearchParams } from "react-router";
import {
  AccessorFnColumnDef,
  AccessorKeyColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  HeaderContext,
  SortingState,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { css } from "@emotion/react";

import {
  ColorSwatch,
  Flex,
  Icon,
  IconButton,
  Icons,
  Modal,
  ModalOverlay,
  ProgressBar,
  Text,
  View,
} from "@phoenix/components";
import {
  AnnotationColorSwatch,
  type AnnotationConfig,
  getPositiveOptimizationFromConfig,
} from "@phoenix/components/annotation";
import { JSONText } from "@phoenix/components/code/JSONText";
import { useExperimentColors } from "@phoenix/components/experiment";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import {
  RichTooltip,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/tooltip";
import { LineClamp } from "@phoenix/components/utility/LineClamp";
import { ExperimentCompareListPageQuery } from "@phoenix/pages/experiment/__generated__/ExperimentCompareListPageQuery.graphql";
import type { ExperimentComparePageQueriesCompareListQuery as ExperimentComparePageQueriesCompareListQueryType } from "@phoenix/pages/experiment/__generated__/ExperimentComparePageQueriesCompareListQuery.graphql";
import { ExperimentCompareDetailsDialog } from "@phoenix/pages/experiment/ExperimentCompareDetailsDialog";
import { ExperimentComparePageQueriesCompareListQuery } from "@phoenix/pages/experiment/ExperimentComparePageQueries";
import { TraceDetailsDialog } from "@phoenix/pages/experiment/TraceDetailsDialog";
import { isObject } from "@phoenix/typeUtils";
import { datasetEvaluatorsToAnnotationConfigs } from "@phoenix/utils/datasetEvaluatorUtils";
import {
  costFormatter,
  floatFormatter,
  intFormatter,
  latencyMsFormatter,
  numberFormatter,
} from "@phoenix/utils/numberFormatUtils";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

import type {
  ExperimentCompareListPage_aggregateData$data,
  ExperimentCompareListPage_aggregateData$key,
} from "./__generated__/ExperimentCompareListPage_aggregateData.graphql";
import type {
  ExperimentCompareListPage_comparisons$data,
  ExperimentCompareListPage_comparisons$key,
} from "./__generated__/ExperimentCompareListPage_comparisons.graphql";
import type {
  ExperimentRunMetric,
  ExperimentRunSort,
  SortDir,
} from "./__generated__/ExperimentCompareListPageQuery.graphql";
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

interface Annotation {
  name: string;
  score: number | null;
  label: string | null;
}
type AnnotationName = string;
type ExperimentId = string;
type BaseExperimentRun = NonNullable<
  ExperimentCompareListPage_comparisons$data["experiment"]["runs"]
>["edges"][number]["run"];
type BaseExperimentRunAnnotation =
  BaseExperimentRun["annotations"]["edges"][number]["annotation"];
type CompareExperimentRun =
  BaseExperimentRun["example"]["experimentRepeatedRunGroups"][number]["runs"][number];
type CompareExperimentRunAnnotation =
  CompareExperimentRun["annotations"]["edges"][number]["annotation"];

type Experiment = NonNullable<
  ExperimentCompareListPage_aggregateData$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

export function ExperimentCompareListPage({
  queryRef,
}: {
  queryRef: PreloadedQuery<ExperimentComparePageQueriesCompareListQueryType>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const experimentIds = useMemo(
    () => searchParams.getAll("experimentId"),
    [searchParams]
  );

  const [selectedExampleIndex, setSelectedExampleIndex] = useState<
    number | null
  >(null);
  const [selectedTraceDetails, setSelectedTraceDetails] = useState<{
    traceId: string;
    projectId: string;
    dialogTitle: string;
  } | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const isFirstRender = useRef<boolean>(true);
  const { getExperimentColor, baseExperimentColor } = useExperimentColors();

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const preloadedData = usePreloadedQuery(
    ExperimentComparePageQueriesCompareListQuery,
    queryRef
  );

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
              id
              experimentAnnotationSummaries {
                annotationName
                minScore
                maxScore
              }
              experiments(filterIds: $experimentIds) {
                edges {
                  experiment: node {
                    id
                    repetitions
                    datasetVersionId
                    averageRunLatencyMs
                    runCount
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
              datasetEvaluators(first: 100) {
                edges {
                  node {
                    name
                    outputConfigs {
                      ... on CategoricalAnnotationConfig {
                        name
                        optimizationDirection
                        values {
                          label
                          score
                        }
                      }
                      ... on ContinuousAnnotationConfig {
                        name
                        optimizationDirection
                        lowerBound
                        upperBound
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      preloadedData
    );

  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<
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
          compareExperimentIds: { type: "[ID!]!" }
          sort: { type: "ExperimentRunSort", defaultValue: null }
        ) {
          experiment: node(id: $baseExperimentId) {
            ... on Experiment {
              id
              runs(first: $first, after: $after, sort: $sort)
                @connection(key: "ExperimentCompareListPage_runs") {
                edges {
                  run: node {
                    id
                    repetitionNumber
                    output
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
                          name
                          score
                          label
                          id
                        }
                      }
                    }
                    example {
                      id
                      revision {
                        input
                        referenceOutput: output
                      }
                      experimentRepeatedRunGroups(
                        experimentIds: $compareExperimentIds
                      ) {
                        experimentId
                        runs {
                          id
                          experimentId
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
                                label
                                id
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
          }
        }
      `,
      preloadedData
    );

  const experiments = useMemo(() => {
    const experimentsById: Record<string, Experiment> = {};
    aggregateData?.dataset.experiments?.edges.forEach((edge) => {
      experimentsById[edge.experiment.id] = edge.experiment;
    });
    const orderedExperiments = experimentIds
      .map((experimentId) => experimentsById[experimentId])
      // if a new experiment was just added, data may not be fully loaded yet
      .filter((experiment) => experiment != null);
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

  const annotationConfigs = useMemo(() => {
    const evaluators =
      aggregateData?.dataset.datasetEvaluators?.edges.map(
        (edge) => edge.node
      ) ?? [];
    return datasetEvaluatorsToAnnotationConfigs(evaluators);
  }, [aggregateData?.dataset.datasetEvaluators?.edges]);

  const annotationConfigsByName = useMemo(() => {
    return annotationConfigs.reduce(
      (acc, config) => {
        acc[config.name] = config;
        return acc;
      },
      {} as Record<string, AnnotationConfig>
    );
  }, [annotationConfigs]);

  const datasetId = aggregateData?.dataset.id;
  const baseExperiment = experiments[0];
  const compareExperimentIds = useMemo(
    () => experiments.slice(1).map((experiment) => experiment.id),
    [experiments]
  );

  const tableData = useMemo(() => {
    return (
      data?.experiment.runs?.edges.map((edge) => {
        const run = edge.run;
        const example = run.example;
        const repeatedRunGroups = example.experimentRepeatedRunGroups
          // prevent layout shift when an experiment is removed
          .filter((group) => experimentIds.includes(group.experimentId));

        const baseExperimentRun: BaseExperimentRun = run;
        const compareExperimentRuns: (CompareExperimentRun | undefined)[] =
          repeatedRunGroups.map((group) => group.runs[0]);

        const baseExperimentRunAnnotationsByName: Record<
          AnnotationName,
          BaseExperimentRunAnnotation
        > = {};
        run.annotations.edges.forEach((edge) => {
          const annotation = edge.annotation;
          baseExperimentRunAnnotationsByName[annotation.name] = annotation;
        });

        const compareExperimentRunAnnotationsByNameAndExperimentId: Record<
          AnnotationName,
          Record<ExperimentId, CompareExperimentRunAnnotation>
        > = {};

        run.example.experimentRepeatedRunGroups.forEach((group) => {
          group.runs.forEach((run) => {
            const experimentId = run.experimentId;
            run.annotations.edges.forEach((edge) => {
              const annotation = edge.annotation;
              if (
                !compareExperimentRunAnnotationsByNameAndExperimentId[
                  annotation.name
                ]
              ) {
                compareExperimentRunAnnotationsByNameAndExperimentId[
                  annotation.name
                ] = {};
              }
              compareExperimentRunAnnotationsByNameAndExperimentId[
                annotation.name
              ][experimentId] = annotation;
            });
          });
        });
        const compareExperimentRunAnnotationsByName: Record<
          AnnotationName,
          (CompareExperimentRunAnnotation | undefined)[]
        > = {};
        annotationSummaries?.forEach((annotationSummary) => {
          const annotationName = annotationSummary.annotationName;
          if (!compareExperimentRunAnnotationsByName[annotationName]) {
            compareExperimentRunAnnotationsByName[annotationName] = [];
          }
          if (
            !compareExperimentRunAnnotationsByNameAndExperimentId[
              annotationName
            ]
          ) {
            compareExperimentRunAnnotationsByNameAndExperimentId[
              annotationName
            ] = {};
          }
          compareExperimentIds.forEach((experimentId) => {
            const annotation =
              compareExperimentRunAnnotationsByNameAndExperimentId[
                annotationName
              ][experimentId];
            compareExperimentRunAnnotationsByName[annotationName].push(
              annotation
            );
          });
        });

        const tableData = {
          id: example.id,
          example: example.id,
          repetitionNumber: baseExperimentRun.repetitionNumber,
          input: example.revision.input,
          referenceOutput: example.revision.referenceOutput,
          outputs: {
            baseExperimentValue: baseExperimentRun.output,
            compareExperimentValues: compareExperimentRuns.map(
              (run) => run?.output
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
          baseExperimentRunAnnotationsByName,
          compareExperimentRunAnnotationsByName,
        };
        return tableData;
      }) ?? []
    );
  }, [data, annotationSummaries, compareExperimentIds, experimentIds]);

  type TableRow = (typeof tableData)[number];
  const columnHelper = useMemo(() => createColumnHelper<TableRow>(), []);

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

  const columns = useMemo(() => {
    // getting the column types right here is challenging, so we type hint each column individually and allow typescript to infer the list type
    const exampleColumn: AccessorKeyColumnDef<TableRow, TableRow["example"]> = {
      header: "example",
      accessorKey: "example",
      size: 110,
      cell: ({ getValue, row }) => {
        const exampleId = getValue() as string;
        return (
          <Flex direction="row" gap="size-100" alignItems="center">
            <TextOverflow>{exampleId}</TextOverflow>
            <TooltipTrigger>
              <IconButton
                size="S"
                aria-label="View experiment run details"
                onPress={() => {
                  setSelectedExampleIndex(row.index);
                }}
                css={css`
                  flex: none;
                `}
              >
                <Icon svg={<Icons.ExpandOutline />} />
              </IconButton>
              <Tooltip>
                <TooltipArrow />
                view experiment runs
              </Tooltip>
            </TooltipTrigger>
          </Flex>
        );
      },
    };
    const repetitionNumberColumn: AccessorKeyColumnDef<
      TableRow,
      TableRow["repetitionNumber"]
    > = {
      header: "repetition",
      size: 64,
      accessorKey: "repetitionNumber",
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <Text size="S" fontFamily="mono">
            {value}
          </Text>
        );
      },
    };
    const inputColumn: AccessorKeyColumnDef<TableRow, TableRow["input"]> = {
      header: "input",
      accessorKey: "input",
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <ContentPreviewTooltip content={value}>
            <LineClamp lines={experiments.length}>
              <JSONText json={value} disableTitle />
            </LineClamp>
          </ContentPreviewTooltip>
        );
      },
    };
    const referenceOutputColumn: AccessorKeyColumnDef<
      TableRow,
      TableRow["referenceOutput"]
    > = {
      header: "reference output",
      accessorKey: "referenceOutput",
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <ContentPreviewTooltip content={value}>
            <LineClamp lines={experiments.length}>
              <JSONText json={value} disableTitle />
            </LineClamp>
          </ContentPreviewTooltip>
        );
      },
    };
    const outputColumn: AccessorKeyColumnDef<TableRow, TableRow["outputs"]> = {
      header: "output",
      accessorKey: "outputs",
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <ul
            css={css`
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-size-50);
            `}
          >
            <li>
              <Flex direction="row" gap="size-100" alignItems="center">
                <span
                  css={css`
                    flex-shrink: 0;
                  `}
                >
                  <ColorSwatch color={baseExperimentColor} shape="circle" />
                </span>
                <ContentPreviewTooltip content={value.baseExperimentValue}>
                  <TextOverflow>
                    <Text size="S" fontFamily="mono">
                      {isObject(value.baseExperimentValue)
                        ? JSON.stringify(value.baseExperimentValue)
                        : String(value.baseExperimentValue)}
                    </Text>
                  </TextOverflow>
                </ContentPreviewTooltip>
              </Flex>
            </li>
            {value.compareExperimentValues.map((value, index) => (
              <li key={index}>
                <Flex direction="row" gap="size-100" alignItems="center">
                  <span
                    css={css`
                      flex-shrink: 0;
                    `}
                  >
                    <ColorSwatch
                      color={getExperimentColor(index)}
                      shape="circle"
                    />
                  </span>
                  {value ? (
                    <ContentPreviewTooltip content={value}>
                      <TextOverflow>
                        <Text size="S" fontFamily="mono">
                          {isObject(value)
                            ? JSON.stringify(value)
                            : String(value)}
                        </Text>
                      </TextOverflow>
                    </ContentPreviewTooltip>
                  ) : (
                    <Text size="S" fontFamily="mono" color="grey-500">
                      not run
                    </Text>
                  )}
                </Flex>
              </li>
            ))}
          </ul>
        );
      },
    };
    const tokensColumn: AccessorKeyColumnDef<TableRow, TableRow["tokens"]> = {
      header: () => (
        <Flex direction="column" gap="size-100">
          <Text size="S" weight="heavy">
            tokens
          </Text>
          <ul
            css={css`
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-size-50);
            `}
          >
            {experiments.map((experiment) => {
              const averageTotalTokens = calculateAverage(
                experiment.costSummary.total.tokens,
                experiment.runCount
              );
              return (
                <li key={experiment.id}>
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <Text size="S" fontFamily="mono" color="grey-500">
                      AVG
                    </Text>
                    <Text size="S" fontFamily="mono">
                      {floatFormatter(averageTotalTokens)}
                    </Text>
                  </Flex>
                </li>
              );
            })}
          </ul>
        </Flex>
      ),
      accessorKey: "tokens",
      minSize: 150,
      enableResizing: false,
      cell: ({ getValue }) => {
        const tokens = getValue();
        return (
          <ul
            css={css`
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-size-50);
            `}
          >
            <li>
              <Flex direction="row" gap="size-100" alignItems="center">
                <ColorSwatch color={baseExperimentColor} shape="circle" />
                <Text size="S" fontFamily="mono">
                  {intFormatter(tokens.baseExperimentValue)}
                </Text>
              </Flex>
            </li>
            {tokens.compareExperimentValues.map((value, index) => (
              <li key={index}>
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ColorSwatch
                    color={getExperimentColor(index)}
                    shape="circle"
                  />
                  <Text size="S" fontFamily="mono">
                    {intFormatter(value)}
                  </Text>
                </Flex>
              </li>
            ))}
          </ul>
        );
      },
    };
    const latencyMsColumn: AccessorKeyColumnDef<
      TableRow,
      TableRow["latencyMs"]
    > = columnHelper.accessor("latencyMs", {
      // the columnHelper pattern is used here because it gives us access to the sorting state within the cell, which is needed to place the sort icon in a reasonable place in the header
      header: ({ column }) => (
        <Flex direction="column" gap="size-100">
          <div
            {...{
              className: column.getCanSort() ? "sort" : "",
              onClick: column.getToggleSortingHandler(),
              style: {
                left: column.getStart(),
                width: column.getSize(),
              },
            }}
          >
            <Text size="S" weight="heavy">
              latency
            </Text>
            {column.getIsSorted() ? (
              <Icon
                className="sort-icon"
                svg={
                  column.getIsSorted() === "asc" ? (
                    <Icons.ArrowUpFilled />
                  ) : (
                    <Icons.ArrowDownFilled />
                  )
                }
              />
            ) : null}
          </div>
          <ul
            css={css`
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-size-50);
            `}
          >
            {experiments.map((experiment) => (
              <li key={experiment.id}>
                <Flex direction="row" gap="size-100" alignItems="center">
                  <Text size="S" fontFamily="mono" color="grey-500">
                    AVG
                  </Text>
                  <Text size="S" fontFamily="mono">
                    {latencyMsFormatter(experiment.averageRunLatencyMs)}
                  </Text>
                </Flex>
              </li>
            ))}
          </ul>
        </Flex>
      ),
      minSize: 150,
      enableResizing: false,
      enableSorting: true,
      cell: ({ getValue }) => {
        const latencyMs = getValue();
        return (
          <ul
            css={css`
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-size-50);
            `}
          >
            <li>
              <Flex direction="row" gap="size-100" alignItems="center">
                <ColorSwatch color={baseExperimentColor} shape="circle" />
                <Text size="S" fontFamily="mono">
                  {latencyMsFormatter(latencyMs.baseExperimentValue)}
                </Text>
              </Flex>
            </li>
            {latencyMs.compareExperimentValues.map((value, index) => (
              <li key={index}>
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ColorSwatch
                    color={getExperimentColor(index)}
                    shape="circle"
                  />
                  <Text size="S" fontFamily="mono">
                    {latencyMsFormatter(value)}
                  </Text>
                </Flex>
              </li>
            ))}
          </ul>
        );
      },
    });
    const costColumn: AccessorKeyColumnDef<TableRow, TableRow["cost"]> = {
      header: () => (
        <Flex direction="column" gap="size-100">
          <Text size="S" weight="heavy">
            cost
          </Text>
          <ul
            css={css`
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-size-50);
            `}
          >
            {experiments.map((experiment) => {
              const averageTotalCost = calculateAverage(
                experiment.costSummary.total.cost,
                experiment.runCount
              );
              return (
                <li key={experiment.id}>
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <Text size="S" fontFamily="mono" color="grey-500">
                      AVG
                    </Text>
                    <Text size="S" fontFamily="mono">
                      {costFormatter(averageTotalCost)}
                    </Text>
                  </Flex>
                </li>
              );
            })}
          </ul>
        </Flex>
      ),
      accessorKey: "cost",
      minSize: 150,
      enableResizing: false,
      cell: ({ getValue }) => {
        const cost = getValue() as TableRow["cost"];
        return (
          <ul
            css={css`
              display: flex;
              flex-direction: column;
              gap: var(--ac-global-dimension-size-50);
            `}
          >
            <li>
              <Flex direction="row" gap="size-100" alignItems="center">
                <ColorSwatch color={baseExperimentColor} shape="circle" />
                <Text size="S" fontFamily="mono">
                  {costFormatter(cost.baseExperimentValue)}
                </Text>
              </Flex>
            </li>
            {cost.compareExperimentValues.map((value, index) => (
              <li key={index}>
                <Flex direction="row" gap="size-100" alignItems="center">
                  <ColorSwatch
                    color={getExperimentColor(index)}
                    shape="circle"
                  />
                  <Text size="S" fontFamily="mono">
                    {costFormatter(value)}
                  </Text>
                </Flex>
              </li>
            ))}
          </ul>
        );
      },
    };
    type AnnotationColumnGetValueReturnType = {
      baseExperimentRunAnnotation: BaseExperimentRunAnnotation;
      compareExperimentRunAnnotations: (
        | CompareExperimentRunAnnotation
        | undefined
      )[];
    };
    const annotationColumns: AccessorFnColumnDef<
      TableRow,
      AnnotationColumnGetValueReturnType
    >[] =
      annotationSummaries?.map((annotationSummary) =>
        columnHelper.accessor(
          // the columnHelper pattern is used here because it gives us access to the sorting state within the cell, which is needed to place the sort icon in a reasonable place in the header

          (row: TableRow) => {
            const baseExperimentRunAnnotation =
              row.baseExperimentRunAnnotationsByName[
                annotationSummary.annotationName
              ];
            const compareExperimentRunAnnotations =
              row.compareExperimentRunAnnotationsByName[
                annotationSummary.annotationName
              ];
            const value: AnnotationColumnGetValueReturnType = {
              baseExperimentRunAnnotation,
              compareExperimentRunAnnotations,
            };
            return value;
          },
          {
            id: annotationSummary.annotationName,
            header: (
              headerContext: HeaderContext<
                TableRow,
                AnnotationColumnGetValueReturnType
              >
            ) => {
              return (
                <Flex direction="column" gap="size-100">
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <AnnotationColorSwatch
                      annotationName={annotationSummary.annotationName}
                    />
                    <div
                      {...{
                        className: headerContext.column.getCanSort()
                          ? "sort"
                          : "",
                        onClick: headerContext.column.getToggleSortingHandler(),
                        style: {
                          left: headerContext.column.getStart(),
                          width: headerContext.column.getSize(),
                        },
                      }}
                    >
                      <Text size="S" weight="heavy">
                        {annotationSummary.annotationName}
                      </Text>
                      {headerContext.column.getIsSorted() ? (
                        <Icon
                          className="sort-icon"
                          svg={
                            headerContext.column.getIsSorted() === "asc" ? (
                              <Icons.ArrowUpFilled />
                            ) : (
                              <Icons.ArrowDownFilled />
                            )
                          }
                        />
                      ) : null}
                    </div>
                  </Flex>
                  <ul
                    css={css`
                      display: flex;
                      flex-direction: column;
                      gap: var(--ac-global-dimension-size-25);
                    `}
                  >
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
                          `}
                        >
                          <Flex
                            direction="row"
                            gap="size-100"
                            alignItems="center"
                          >
                            <Text size="S" fontFamily="mono" color="grey-500">
                              AVG
                            </Text>
                            <Text size="S" fontFamily="mono">
                              {numberFormatter(
                                experimentAnnotationSummary?.meanScore
                              )}
                            </Text>
                          </Flex>
                          {typeof experimentAnnotationSummary?.meanScore ===
                          "number" ? (
                            <ProgressBar
                              width="100%"
                              height="var(--ac-global-dimension-size-25)"
                              value={calculateAnnotationScorePercentile(
                                experimentAnnotationSummary.meanScore,
                                annotationSummary.minScore,
                                annotationSummary.maxScore
                              )}
                              aria-label={`${annotationSummary.annotationName} mean score`}
                            />
                          ) : (
                            <ProgressBarPlaceholder />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Flex>
              );
            },
            minSize: 200,
            enableResizing: false,
            cell: ({ getValue }) => {
              const {
                baseExperimentRunAnnotation,
                compareExperimentRunAnnotations,
              } = getValue();
              const annotationConfig =
                annotationConfigsByName[annotationSummary.annotationName];
              const baseExperimentRunAnnotationValue = getAnnotationValue(
                baseExperimentRunAnnotation
              );
              const baseExperimentRunAnnotationValueFormatted =
                typeof baseExperimentRunAnnotationValue === "number"
                  ? numberFormatter(baseExperimentRunAnnotationValue)
                  : baseExperimentRunAnnotationValue;
              const basePositiveOptimization =
                getPositiveOptimizationFromConfig({
                  config: annotationConfig,
                  score: baseExperimentRunAnnotation?.score,
                });

              return (
                <ul
                  css={css`
                    display: flex;
                    flex-direction: column;
                    gap: var(--ac-global-dimension-size-25);
                  `}
                >
                  <AnnotationValueItem
                    value={baseExperimentRunAnnotationValueFormatted}
                    numericValue={baseExperimentRunAnnotationValue}
                    positiveOptimization={basePositiveOptimization}
                    barColor={baseExperimentColor}
                    minScore={annotationSummary.minScore}
                    maxScore={annotationSummary.maxScore}
                    annotationName={annotationSummary.annotationName}
                  />
                  {compareExperimentRunAnnotations.map(
                    (
                      annotation: CompareExperimentRunAnnotation | undefined,
                      index: number
                    ) => {
                      const compareAnnotationValue =
                        getAnnotationValue(annotation);
                      const compareAnnotationValueFormatted =
                        typeof compareAnnotationValue === "number"
                          ? numberFormatter(compareAnnotationValue)
                          : compareAnnotationValue;
                      const color = getExperimentColor(index);
                      const positiveOptimization =
                        getPositiveOptimizationFromConfig({
                          config: annotationConfig,
                          score: annotation?.score,
                        });
                      return (
                        <AnnotationValueItem
                          key={index}
                          value={compareAnnotationValueFormatted}
                          numericValue={compareAnnotationValue}
                          positiveOptimization={positiveOptimization}
                          barColor={color}
                          minScore={annotationSummary.minScore}
                          maxScore={annotationSummary.maxScore}
                          annotationName={annotationSummary.annotationName}
                        />
                      );
                    }
                  )}
                </ul>
              );
            },
          }
        )
      ) ?? [];
    const columns = [
      exampleColumn,
      repetitionNumberColumn,
      inputColumn,
      referenceOutputColumn,
      outputColumn,
      tokensColumn,
      latencyMsColumn,
      costColumn,
      ...annotationColumns,
    ];
    return columns;
  }, [
    annotationConfigsByName,
    annotationSummaries,
    baseExperimentColor,
    columnHelper,
    experiments,
    getExperimentColor,
  ]);

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
    state: {
      sorting,
      columnVisibility: {
        repetitionNumber: baseExperiment.repetitions > 1 ? true : false,
      },
    },
    manualSorting: true,
  });

  // Refetch data when sorting changes
  useEffect(() => {
    // Skip the first render. It's been loaded by the parent
    if (isFirstRender.current === true) {
      isFirstRender.current = false;
      return;
    }
    let gqlSort: ExperimentRunSort | undefined = undefined;
    if (sorting.length > 0) {
      const sort = sorting[0];
      const dir: SortDir = sort.desc ? "desc" : "asc";
      const sortId = sort.id;
      let metric: ExperimentRunMetric | undefined = undefined;
      let annotationName: string | undefined = undefined;
      if (isExperimentRunMetric(sortId)) {
        metric = sortId;
      } else {
        annotationName = sortId;
      }
      gqlSort = {
        col: { metric, annotationName },
        dir,
      };
    }
    startTransition(() => {
      refetch(
        {
          after: null,
          first: 50,
          sort: gqlSort,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  }, [sorting, refetch]);

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => {
      const numExperiments = experiments.length;
      // 29px [cell padding + border]
      // + 20px * numExperiments [line height per experiment metric line]
      // + 4px * (numExperiments - 1) [gap between experiment metric lines]
      return 29 + numExperiments * 20 + 4 * (numExperiments - 1);
    },
    overscan: 10,
  });

  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   */
  const tableState = table.getState();
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${makeSafeColumnId(header.id)}-size`] =
        header.getSize();
      colSizes[`--col-${makeSafeColumnId(header.column.id)}-size`] =
        header.column.getSize();
    }
    return colSizes;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tableState.columnSizingInfo,
    tableState.columnSizing,
    tableState.columnVisibility,
  ]);

  const exampleIds = useMemo(() => {
    return rows.map((row) => row.original.example);
  }, [rows]);

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
              ...columnSizeVars,
              width: table.getTotalSize(),
              minWidth: "100%",
              tableLayout: "fixed",
            }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => (
                    <th
                      key={header.id + "-" + index}
                      style={{
                        width: `calc(var(--header-${makeSafeColumnId(header?.id)}-size) * 1px)`,
                        padding:
                          "var(--ac-global-dimension-size-175) var(--ac-global-dimension-size-200)",
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanResize() && (
                            <div
                              {...{
                                onMouseDown: header.getResizeHandler(),
                                onTouchStart: header.getResizeHandler(),
                                className: `resizer ${
                                  header.column.getIsResizing()
                                    ? "isResizing"
                                    : ""
                                }`,
                              }}
                            />
                          )}
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            {table.getState().columnSizingInfo.isResizingColumn ? (
              /* When resizing any column we will render this special memoized version of our table body */
              <MemoizedTableBody table={table} virtualizer={virtualizer} />
            ) : (
              <TableBody table={table} virtualizer={virtualizer} />
            )}
          </table>
        </div>
      </Flex>
      <ModalOverlay
        isOpen={selectedExampleIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedExampleIndex(null);
          }
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          {selectedExampleIndex !== null &&
            datasetId &&
            rows[selectedExampleIndex] && (
              <ExperimentCompareDetailsDialog
                repetitionNumber={
                  baseExperiment?.repetitions > 1
                    ? rows[selectedExampleIndex].original.repetitionNumber
                    : undefined
                }
                datasetId={datasetId}
                datasetVersionId={baseExperiment?.datasetVersionId}
                selectedExampleIndex={selectedExampleIndex}
                selectedExampleId={rows[selectedExampleIndex].original.example}
                baseExperimentId={baseExperiment?.id}
                compareExperimentIds={compareExperimentIds}
                exampleIds={exampleIds}
                onExampleChange={(exampleIndex) => {
                  if (
                    exampleIndex === exampleIds.length - 1 &&
                    !isLoadingNext &&
                    hasNext
                  ) {
                    loadNext(PAGE_SIZE);
                  }
                  if (exampleIndex >= 0 && exampleIndex < exampleIds.length) {
                    setSelectedExampleIndex(exampleIndex);
                  }
                }}
                openTraceDialog={(traceId, projectId, title) => {
                  setSelectedTraceDetails({
                    traceId,
                    projectId,
                    dialogTitle: title,
                  });
                }}
              />
            )}
        </Modal>
      </ModalOverlay>
      <ModalOverlay
        isOpen={selectedTraceDetails !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            // Clear the URL search params for the span selection
            setSearchParams(
              (prev) => {
                const newParams = new URLSearchParams(prev);
                newParams.delete("selectedSpanNodeId");
                return newParams;
              },
              { replace: true }
            );
            setSelectedTraceDetails(null);
          }
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          {selectedTraceDetails !== null && (
            <TraceDetailsDialog
              traceId={selectedTraceDetails.traceId}
              projectId={selectedTraceDetails.projectId}
              title={selectedTraceDetails.dialogTitle}
            />
          )}
        </Modal>
      </ModalOverlay>
    </View>
  );
}

/**
 * A single annotation value item with optimization direction coloring
 */
function AnnotationValueItem({
  value,
  numericValue,
  positiveOptimization,
  barColor,
  minScore,
  maxScore,
  annotationName,
}: {
  value: string | number;
  numericValue: string | number;
  positiveOptimization: boolean | null;
  barColor: string;
  minScore: number | null;
  maxScore: number | null;
  annotationName: string;
}) {
  const bgColor =
    positiveOptimization === true
      ? "var(--ac-global-color-success-100)"
      : positiveOptimization === false
        ? "var(--ac-global-color-danger-100)"
        : undefined;
  const textColor =
    positiveOptimization === true
      ? "success"
      : positiveOptimization === false
        ? "danger"
        : undefined;
  const optimizedBarColor =
    positiveOptimization === true
      ? "var(--ac-global-color-success-500)"
      : positiveOptimization === false
        ? "var(--ac-global-color-danger-500)"
        : barColor;

  return (
    <li
      css={css`
        --mod-barloader-fill-color: ${optimizedBarColor};
        ${bgColor ? `background-color: ${bgColor};` : ""}
        padding: var(--ac-global-dimension-size-25)
          var(--ac-global-dimension-size-50);
        border-radius: var(--ac-global-rounding-small);
        margin: calc(-1 * var(--ac-global-dimension-size-25))
          calc(-1 * var(--ac-global-dimension-size-50));
      `}
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        <Text size="S" fontFamily="mono" color={textColor}>
          {value}
        </Text>
      </Flex>
      {typeof numericValue === "number" ? (
        <ProgressBar
          width="100%"
          height="var(--ac-global-dimension-size-25)"
          value={calculateAnnotationScorePercentile(
            numericValue,
            minScore,
            maxScore
          )}
          aria-label={`${annotationName} score`}
        />
      ) : (
        <ProgressBarPlaceholder />
      )}
    </li>
  );
}

//un-memoized normal table body component - see memoized version below
function TableBody<T>({
  table,
  virtualizer,
}: {
  table: Table<T>;
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
}) {
  "use no memo";
  const rows = table.getRowModel().rows;
  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const spacerRowHeight = useMemo(() => {
    return totalHeight - virtualRows.reduce((acc, item) => acc + item.size, 0);
  }, [totalHeight, virtualRows]);

  return (
    <tbody>
      {virtualRows.map((virtualRow, index) => {
        const row = rows[virtualRow.index];
        return (
          <tr
            key={row.id}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${
                virtualRow.start - index * virtualRow.size
              }px)`,
            }}
          >
            {row.getVisibleCells().map((cell, index) => (
              <td
                key={cell.id + "-" + index}
                style={{
                  width: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
                  maxWidth: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
                  padding:
                    "var(--ac-global-dimension-size-175) var(--ac-global-dimension-size-200)",
                  verticalAlign: "middle",
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        );
      })}
      {/* Add a spacer row to ensure the sticky header does not scroll out of view and to make scrolling smoother */}
      <tr>
        <td
          style={{
            height: `${spacerRowHeight}px`,
            padding: 0,
          }}
          colSpan={table.getVisibleLeafColumns().length}
        />
      </tr>
    </tbody>
  );
}

//special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

const getAnnotationValue = (annotation: Annotation | undefined) => {
  return annotation?.score ?? annotation?.label ?? "--";
};

const calculateAverage = (
  total: number | null,
  runCount: number
): number | null => {
  return total === null || runCount === 0 ? null : total / runCount;
};

function ContentPreviewTooltip({
  content,
  children,
}: {
  content: unknown;
  children: React.ReactNode;
}) {
  return (
    <TooltipTrigger>
      <TriggerWrap
        css={css`
          overflow: hidden;
        `}
      >
        {children}
      </TriggerWrap>
      <RichTooltip
        placement="right"
        offset={3}
        css={css`
          overflow-y: auto;
        `}
      >
        {isObject(content) ? (
          <JSONText json={content} disableTitle space={2} />
        ) : (
          <Text size="S" fontFamily="mono">
            {String(content)}
          </Text>
        )}
      </RichTooltip>
    </TooltipTrigger>
  );
}

const textOverflowCSS = css`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;

  // prevent default behavior of title tooltip showing on safari
  &::after {
    content: "";
    display: block;
  }
`;

function TextOverflow({ children }: { children: React.ReactNode }) {
  return <div css={textOverflowCSS}>{children}</div>;
}

const progressBarPlaceholderCSS = css`
  width: 100%;
  height: var(--ac-global-dimension-size-25);
`;

function ProgressBarPlaceholder() {
  return <div css={progressBarPlaceholderCSS} />;
}

/**
 * Type guard for ExperimentRunMetric
 */
function isExperimentRunMetric(sortId: string): sortId is ExperimentRunMetric {
  return sortId === "latencyMs";
}
