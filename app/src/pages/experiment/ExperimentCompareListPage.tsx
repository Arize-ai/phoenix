import { memo, useCallback, useMemo, useRef, useState } from "react";
import { graphql, useFragment, usePaginationFragment } from "react-relay";
import { useLoaderData, useSearchParams } from "react-router";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Getter,
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
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
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
import { ExperimentCompareDetailsDialog } from "@phoenix/pages/experiment/ExperimentCompareDetailsDialog";
import { isObject } from "@phoenix/typeUtils";
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

type BaseExperimentRun = NonNullable<
  ExperimentCompareListPage_comparisons$data["experiment"]["runs"]
>["edges"][number]["run"];
type CompareExperimentRun =
  BaseExperimentRun["example"]["experimentRepeatedRunGroups"][number]["runs"][number];

type Experiment = NonNullable<
  ExperimentCompareListPage_aggregateData$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

export function ExperimentCompareListPage() {
  const [searchParams] = useSearchParams();
  const experimentIds = searchParams.getAll("experimentId");

  const [selectedExampleIndex, setSelectedExampleIndex] = useState<
    number | null
  >(null);

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
        compareExperimentIds: { type: "[ID!]!" }
      ) {
        experiment: node(id: $baseExperimentId) {
          ... on Experiment {
            id
            runs(first: $first, after: $after)
              @connection(key: "ExperimentCompareListPage_runs") {
              edges {
                run: node {
                  id
                  repetitionNumber
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

  const datasetId = aggregateData?.dataset.id;
  const baseExperiment = experiments[0];
  const compareExperimentIds = experiments
    .slice(1)
    .map((experiment) => experiment.id);

  const tableData = useMemo(() => {
    return (
      data?.experiment.runs?.edges.map((edge) => {
        const run = edge.run;
        const example = run.example;
        const repeatedRunGroups = example.experimentRepeatedRunGroups;

        const baseExperimentRun: BaseExperimentRun = run;
        const compareExperimentRuns: (CompareExperimentRun | undefined)[] =
          repeatedRunGroups.map((group) => group.runs[0]);
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
          annotations: {
            baseExperimentValue: run.annotations.edges.map((edge) => ({
              name: edge.annotation.name,
              score: edge.annotation.score,
              label: edge.annotation.label,
            })),
            compareExperimentValues: compareExperimentRuns.map(
              (run) =>
                run?.annotations.edges.map((edge) => ({
                  name: edge.annotation.name,
                  score: edge.annotation.score,
                  label: edge.annotation.label,
                })) ?? []
            ),
          },
        };
        return tableData;
      }) ?? []
    );
  }, [data]);

  type TableRow = (typeof tableData)[number];

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
      },
      {
        header: "repetition",
        size: 64,
        accessorKey: "repetitionNumber",
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return (
            <Text size="S" fontFamily="mono">
              {value}
            </Text>
          );
        },
      },
      {
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
      },
      {
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
      },
      {
        header: "output",
        accessorKey: "outputs",
        cell: ({ getValue }) => {
          const value = getValue() as TableRow["outputs"];
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
      },
      {
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
          const tokens = getValue() as TableRow["tokens"];
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
      },
      {
        header: () => (
          <Flex direction="column" gap="size-100">
            <Text size="S" weight="heavy">
              latency
            </Text>
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
        accessorKey: "latencyMs",
        minSize: 150,
        enableResizing: false,
        cell: ({ getValue }) => {
          const latencyMs = getValue() as TableRow["latencyMs"];
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
      },
      {
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
                    <Flex direction="row" gap="size-100" alignItems="center">
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
        ),
        accessorKey: "annotations",
        minSize: 200,
        enableResizing: false,
        cell: ({ getValue }: { getValue: Getter<TableRow["annotations"]> }) => {
          const annotations = getValue();
          const baseExperimentAnnotationValue = getAnnotationValue(
            annotations.baseExperimentValue,
            annotationSummary.annotationName
          );
          const baseExperimentAnnotationValueFormatted =
            typeof baseExperimentAnnotationValue === "number"
              ? numberFormatter(baseExperimentAnnotationValue)
              : baseExperimentAnnotationValue;

          return (
            <ul
              css={css`
                display: flex;
                flex-direction: column;
                gap: var(--ac-global-dimension-size-25);
              `}
            >
              <li
                css={css`
                  --mod-barloader-fill-color: ${baseExperimentColor};
                `}
              >
                <Flex direction="row" gap="size-100" alignItems="center">
                  <Text size="S" fontFamily="mono">
                    {baseExperimentAnnotationValueFormatted}
                  </Text>
                </Flex>
                {typeof baseExperimentAnnotationValue === "number" ? (
                  <ProgressBar
                    width="100%"
                    height="var(--ac-global-dimension-size-25)"
                    value={calculateAnnotationScorePercentile(
                      baseExperimentAnnotationValue,
                      annotationSummary.minScore,
                      annotationSummary.maxScore
                    )}
                    aria-label={`${annotationSummary.annotationName} score`}
                  />
                ) : (
                  <ProgressBarPlaceholder />
                )}
              </li>
              {annotations.compareExperimentValues.map((values, index) => {
                const compareExperimentAnnotationValue = getAnnotationValue(
                  values,
                  annotationSummary.annotationName
                );
                const compareExperimentAnnotationValueFormatted =
                  typeof compareExperimentAnnotationValue === "number"
                    ? numberFormatter(compareExperimentAnnotationValue)
                    : compareExperimentAnnotationValue;
                const color = getExperimentColor(index);
                return (
                  <li
                    key={index}
                    css={css`
                      --mod-barloader-fill-color: ${color};
                    `}
                  >
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <Text size="S" fontFamily="mono">
                        {compareExperimentAnnotationValueFormatted}
                      </Text>
                    </Flex>
                    {typeof compareExperimentAnnotationValue === "number" ? (
                      <ProgressBar
                        width="100%"
                        height="var(--ac-global-dimension-size-25)"
                        value={calculateAnnotationScorePercentile(
                          compareExperimentAnnotationValue,
                          annotationSummary.minScore,
                          annotationSummary.maxScore
                        )}
                        aria-label={`${annotationSummary.annotationName} score`}
                      />
                    ) : (
                      <ProgressBarPlaceholder />
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
    columnResizeMode: "onChange",
    state: {
      columnVisibility: {
        repetitionNumber: baseExperiment.repetitions > 1 ? true : false,
      },
    },
  });

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
    // eslint-disable-next-line react-compiler/react-compiler
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
              />
            )}
        </Modal>
      </ModalOverlay>
    </View>
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
          colSpan={table.getAllColumns().length}
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

const getAnnotationValue = (
  values: { name: string; score: number | null; label: string | null }[],
  annotationName: string
) => {
  const annotation = values.find(
    (annotation) => annotation.name === annotationName
  );
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
