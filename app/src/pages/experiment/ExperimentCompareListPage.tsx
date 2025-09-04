import { memo, useCallback, useMemo, useRef } from "react";
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
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/tooltip";
import { isObject } from "@phoenix/typeUtils";
import {
  costFormatter,
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

type Example =
  ExperimentCompareListPage_comparisons$data["compareExperiments"]["edges"][number]["comparison"]["example"];

type ExperimentRun =
  ExperimentCompareListPage_comparisons$data["compareExperiments"]["edges"][number]["comparison"]["runComparisonItems"][number]["runs"][number];

type Experiment = NonNullable<
  ExperimentCompareListPage_aggregateData$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type TableRow = {
  id: Example["id"];
  example: Example["id"];
  input: Example["revision"]["input"];
  referenceOutput: Example["revision"]["referenceOutput"];
  outputs: {
    baseExperimentValue: ExperimentRun["output"];
    compareExperimentValues: (ExperimentRun["output"] | undefined)[];
  };
  tokens: {
    baseExperimentValue: ExperimentRun["costSummary"]["total"]["tokens"];
    compareExperimentValues: (
      | ExperimentRun["costSummary"]["total"]["tokens"]
      | undefined
    )[];
  };
  latencyMs: {
    baseExperimentValue: number;
    compareExperimentValues: (number | null | undefined)[];
  };
  cost: {
    baseExperimentValue: ExperimentRun["costSummary"]["total"]["cost"];
    compareExperimentValues: (
      | ExperimentRun["costSummary"]["total"]["cost"]
      | undefined
    )[];
  };
  annotations: {
    baseExperimentValue: ExperimentRun["annotations"]["edges"][number]["annotation"][];
    compareExperimentValues: ExperimentRun["annotations"]["edges"][number]["annotation"][][];
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
                        label
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
            baseExperimentValue: baseExperimentRun.annotations.edges.map(
              (edge) => ({
                name: edge.annotation.name,
                score: edge.annotation.score,
                label: edge.annotation.label,
              })
            ),
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
        size: 80,
        cell: ({ getValue }) => (
          <TextOverflow>{getValue() as string}</TextOverflow>
        ),
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
                return (
                  <li key={experiment.id}>
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <Text size="S" fontFamily="mono" color="grey-500">
                        AVG
                      </Text>
                      <Text size="S" fontFamily="mono">
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
              {experiments.map((experiment) => (
                <li key={experiment.id}>
                  <Flex direction="row" gap="size-100" alignItems="center">
                    <Text size="S" fontFamily="mono" color="grey-500">
                      AVG
                    </Text>
                    <Text size="S" fontFamily="mono">
                      {costFormatter(experiment.costSummary.total.cost)}
                    </Text>
                  </Flex>
                </li>
              ))}
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
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

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

const lineClampCSS = (lines: number) => css`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: ${lines};
  overflow: hidden;
`;

function LineClamp({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: number;
}) {
  return <div css={lineClampCSS(lines)}>{children}</div>;
}

const progressBarPlaceholderCSS = css`
  width: 100%;
  height: var(--ac-global-dimension-size-25);
`;

function ProgressBarPlaceholder() {
  return <div css={progressBarPlaceholderCSS} />;
}
