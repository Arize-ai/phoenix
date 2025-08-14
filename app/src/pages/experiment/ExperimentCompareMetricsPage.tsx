import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { useLoaderData, useSearchParams } from "react-router";
import { css } from "@emotion/react";

import {
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { ColorSwatch } from "@phoenix/components/ColorSwatch";
import { useExperimentColors } from "@phoenix/components/experiment";
import {
  costFormatter,
  latencyMsFormatter,
  numberFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type {
  ExperimentCompareMetricsPage_experiments$data,
  ExperimentCompareMetricsPage_experiments$key,
} from "./__generated__/ExperimentCompareMetricsPage_experiments.graphql";
import type { experimentCompareLoader } from "./experimentCompareLoader";

type OptimizationDirection = "MAXIMIZE" | "MINIMIZE";

const thumbIconCSS = css`
  font-size: var(--ac-global-text-font-size-l);
`;

const metricCardCSS = css`
  padding: var(--ac-global-dimension-size-200);
  border: 1px solid var(--ac-global-color-grey-200);
  border-radius: var(--ac-global-rounding-medium);
  transition: border-color 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--ac-global-dimension-size-200);
  height: 100%;
`;

type MetricValue = number | null | undefined;

type ExperimentComparison = {
  compareExperimentId: string;
  compareExperimentValue: MetricValue;
  compareExperimentColor: string;
};

type Experiment = NonNullable<
  ExperimentCompareMetricsPage_experiments$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

export function ExperimentCompareMetricsPage() {
  const [searchParams] = useSearchParams();
  const [baseExperimentId = undefined, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  if (baseExperimentId == null) {
    throw new Error("Empty state not yet implemented");
  }
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  const { getExperimentColor } = useExperimentColors();
  const data = useFragment<ExperimentCompareMetricsPage_experiments$key>(
    graphql`
      fragment ExperimentCompareMetricsPage_experiments on Query
      @argumentDefinitions(
        datasetId: { type: "ID!" }
        baseExperimentId: { type: "ID!" }
        compareExperimentIds: { type: "[ID!]!" }
        experimentIds: { type: "[ID!]!" }
        hasCompareExperiments: { type: "Boolean!" }
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
                    prompt {
                      tokens
                      cost
                    }
                    completion {
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
        experimentRunMetricComparisons(
          baseExperimentId: $baseExperimentId
          compareExperimentIds: $compareExperimentIds
        ) @include(if: $hasCompareExperiments) {
          latency {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
          }
          totalTokenCount {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
          }
          promptTokenCount {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
          }
          completionTokenCount {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
          }
          totalCost {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
          }
          promptCost {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
          }
          completionCost {
            numRunsImproved
            numRunsRegressed
            numRunsEqual
          }
        }
      }
    `,
    loaderData
  );
  if (!data) {
    throw new Error("Empty state not implemented");
  }

  const {
    annotationMetrics,
    costMetrics,
    performanceMetrics,
    tokenCountMetrics,
  } = useMemo(() => {
    const experimentIdToExperiment: Record<string, Experiment> = {};
    data.dataset.experiments?.edges.forEach((edge) => {
      const experiment = edge.experiment;
      experimentIdToExperiment[experiment.id] = experiment;
    });
    const baseExperiment = experimentIdToExperiment[baseExperimentId];
    const compareExperiments = compareExperimentIds.map((experimentId) => {
      return experimentIdToExperiment[experimentId];
    });

    const counts = data.experimentRunMetricComparisons;
    const latencyMetric: MetricCardProps = {
      title: "Latency",
      baseExperimentValue: baseExperiment.averageRunLatencyMs,
      delta: {
        numImprovements: counts?.latency.numRunsImproved ?? 0,
        numRegressions: counts?.latency.numRunsRegressed ?? 0,
        numEqual: counts?.latency.numRunsEqual ?? 0,
        optimizationDirection: "MAXIMIZE",
      },
      comparisons: [],
      formatter: latencyMsFormatter,
    };
    const totalTokensMetric: MetricCardProps = {
      title: "Total Tokens",
      baseExperimentValue: baseExperiment.costSummary.total.tokens,
      delta: {
        numImprovements: counts?.totalTokenCount.numRunsImproved ?? 0,
        numRegressions: counts?.totalTokenCount.numRunsRegressed ?? 0,
        numEqual: counts?.totalTokenCount.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      comparisons: [],
    };
    const promptTokensMetric: MetricCardProps = {
      title: "Prompt Tokens",
      baseExperimentValue: baseExperiment.costSummary.prompt.tokens,
      delta: {
        numImprovements: counts?.promptTokenCount.numRunsImproved ?? 0,
        numRegressions: counts?.promptTokenCount.numRunsRegressed ?? 0,
        numEqual: counts?.promptTokenCount.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      comparisons: [],
    };
    const completionTokensMetric: MetricCardProps = {
      title: "Completion Tokens",
      baseExperimentValue: baseExperiment.costSummary.completion.tokens,
      delta: {
        numImprovements: counts?.completionTokenCount.numRunsImproved ?? 0,
        numRegressions: counts?.completionTokenCount.numRunsRegressed ?? 0,
        numEqual: counts?.completionTokenCount.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      comparisons: [],
    };
    const totalCostMetric: MetricCardProps = {
      title: "Total Cost",
      baseExperimentValue: baseExperiment.costSummary.total.cost,
      delta: {
        numImprovements: counts?.totalCost.numRunsImproved ?? 0,
        numRegressions: counts?.totalCost.numRunsRegressed ?? 0,
        numEqual: counts?.totalCost.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      comparisons: [],
      formatter: costFormatter,
    };
    const promptCostMetric: MetricCardProps = {
      title: "Prompt Cost",
      baseExperimentValue: baseExperiment.costSummary.prompt.cost,
      delta: {
        numImprovements: counts?.promptCost.numRunsImproved ?? 0,
        numRegressions: counts?.promptCost.numRunsRegressed ?? 0,
        numEqual: counts?.promptCost.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      comparisons: [],
      formatter: costFormatter,
    };
    const completionCostMetric: MetricCardProps = {
      title: "Completion Cost",
      baseExperimentValue: baseExperiment.costSummary.completion.cost,
      delta: {
        numImprovements: counts?.completionCost.numRunsImproved ?? 0,
        numRegressions: counts?.completionCost.numRunsRegressed ?? 0,
        numEqual: counts?.completionCost.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      comparisons: [],
      formatter: costFormatter,
    };
    compareExperiments.forEach((experiment, experimentIndex) => {
      const experimentColor = getExperimentColor(experimentIndex);
      latencyMetric.comparisons.push({
        compareExperimentId: experiment.id,
        compareExperimentValue: experiment.averageRunLatencyMs,
        compareExperimentColor: experimentColor,
      });
      promptTokensMetric.comparisons.push({
        compareExperimentId: experiment.id,
        compareExperimentValue: experiment.costSummary.prompt.tokens,
        compareExperimentColor: experimentColor,
      });
      completionTokensMetric.comparisons.push({
        compareExperimentId: experiment.id,
        compareExperimentValue: experiment.costSummary.completion.tokens,
        compareExperimentColor: experimentColor,
      });
      totalTokensMetric.comparisons.push({
        compareExperimentId: experiment.id,
        compareExperimentValue: experiment.costSummary.total.tokens,
        compareExperimentColor: experimentColor,
      });
      totalCostMetric.comparisons.push({
        compareExperimentId: experiment.id,
        compareExperimentValue: experiment.costSummary.total.cost,
        compareExperimentColor: experimentColor,
      });
      promptCostMetric.comparisons.push({
        compareExperimentId: experiment.id,
        compareExperimentValue: experiment.costSummary.prompt.cost,
        compareExperimentColor: experimentColor,
      });
      completionCostMetric.comparisons.push({
        compareExperimentId: experiment.id,
        compareExperimentValue: experiment.costSummary.completion.cost,
        compareExperimentColor: experimentColor,
      });
    });
    const performanceMetrics = [latencyMetric];
    const costMetrics = [
      totalCostMetric,
      promptCostMetric,
      completionCostMetric,
    ];
    const tokenCountMetrics = [
      totalTokensMetric,
      promptTokensMetric,
      completionTokensMetric,
    ];

    const annotationNameToBaseExperimentMeanScore: Record<string, number> = {};
    baseExperiment.annotationSummaries?.forEach((annotation) => {
      if (annotation.meanScore != null) {
        annotationNameToBaseExperimentMeanScore[annotation.annotationName] =
          annotation.meanScore;
      }
    });
    const annotationNameToCompareExperimentIdToMeanScore: Record<
      string,
      Record<string, number>
    > = {};
    compareExperiments.forEach((experiment) => {
      experiment.annotationSummaries?.forEach((annotationSummary) => {
        const annotationName = annotationSummary.annotationName;
        const experimentId = experiment.id;
        const meanScore = annotationSummary.meanScore;
        if (experimentId != null && meanScore != null) {
          if (
            !(annotationName in annotationNameToCompareExperimentIdToMeanScore)
          ) {
            annotationNameToCompareExperimentIdToMeanScore[annotationName] = {};
          }
          annotationNameToCompareExperimentIdToMeanScore[annotationName][
            experimentId
          ] = meanScore;
        }
      });
    });
    const annotationMetrics: MetricCardProps[] = [];
    for (const annotationName in annotationNameToBaseExperimentMeanScore) {
      const baseExperimentMeanScore =
        annotationNameToBaseExperimentMeanScore[annotationName];
      if (!(annotationName in annotationNameToCompareExperimentIdToMeanScore)) {
        continue;
      }
      const annotationMetricComparisons: ExperimentComparison[] = [];
      compareExperiments.forEach((experiment, experimentIndex) => {
        const compareExperimentId = experiment.id;
        const compareExperimentColor = getExperimentColor(experimentIndex);
        let compareExperimentMeanScore: MetricValue = null;
        if (
          compareExperimentId == null ||
          !(
            compareExperimentId in
            annotationNameToCompareExperimentIdToMeanScore[annotationName]
          )
        ) {
          compareExperimentMeanScore = null;
        } else {
          compareExperimentMeanScore =
            annotationNameToCompareExperimentIdToMeanScore[annotationName][
              compareExperimentId
            ];
        }
        annotationMetricComparisons.push({
          compareExperimentId: compareExperimentId,
          compareExperimentValue: compareExperimentMeanScore,
          compareExperimentColor,
        });
      });
      annotationMetrics.push({
        title: annotationName,
        baseExperimentValue: baseExperimentMeanScore,
        comparisons: annotationMetricComparisons,
      });
    }
    return {
      annotationMetrics,
      costMetrics,
      performanceMetrics,
      tokenCountMetrics,
    };
  }, [baseExperimentId, compareExperimentIds, data, getExperimentColor]);

  return (
    <div
      css={css`
        overflow: auto;
        padding: var(--ac-global-dimension-size-200);
        height: 100%;
      `}
    >
      <div
        css={css`
          min-width: 1280px;
        `}
      >
        <Flex direction="row" gap="size-250">
          {annotationMetrics.length > 0 && (
            <MetricsColumn title="Evaluations" metrics={annotationMetrics} />
          )}
          <MetricsColumn title="Cost" metrics={costMetrics} />
          <MetricsColumn title="Performance" metrics={performanceMetrics} />
          <MetricsColumn title="Token Counts" metrics={tokenCountMetrics} />
        </Flex>
      </div>
    </div>
  );
}

function MetricsColumn({
  title,
  metrics,
}: {
  title: string;
  metrics: MetricCardProps[];
}) {
  return (
    <View>
      <Heading
        level={2}
        css={css`
          margin-bottom: var(--ac-global-dimension-size-150);
        `}
      >
        {title}
      </Heading>
      <ul
        css={css`
          display: grid;
          grid-template-columns: repeat(
            auto-fill,
            minmax(var(--ac-global-dimension-size-3600), 1fr)
          );
          gap: var(--ac-global-dimension-size-200);
        `}
      >
        {metrics.map((metric: MetricCardProps) => (
          <li
            key={metric.title}
            css={css`
              display: flex;
              flex-direction: column;
              height: 100%;
            `}
          >
            <MetricCard {...metric} />
          </li>
        ))}
      </ul>
    </View>
  );
}

type MetricDelta = {
  numImprovements: number;
  numRegressions: number;
  numEqual: number;
  optimizationDirection: OptimizationDirection;
};

type MetricCardProps = {
  title: string;
  baseExperimentValue: MetricValue;
  comparisons: ExperimentComparison[];
  formatter?: (value: MetricValue) => string;
  delta?: MetricDelta;
};

function MetricCard({
  title,
  baseExperimentValue,
  delta,
  comparisons,
  formatter = numberFormatter,
}: MetricCardProps) {
  const { baseExperimentColor } = useExperimentColors();
  return (
    <div css={metricCardCSS}>
      <Flex direction="column" gap="size-200">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Heading level={3}>{title}</Heading>
          {delta && <ImprovementAndRegressionCounter {...delta} />}
        </Flex>
        <HorizontalBarChart
          bars={[
            {
              value: baseExperimentValue ?? 0,
              color: baseExperimentColor,
            },
            ...comparisons.map((comparison) => ({
              value: comparison.compareExperimentValue ?? 0,
              color: comparison.compareExperimentColor,
            })),
          ]}
        />
        <Flex direction="column">
          <BaseExperimentMetric
            value={baseExperimentValue}
            formatter={formatter}
          />
          {comparisons.map((comparison) => (
            <CompareExperimentMetric
              key={comparison.compareExperimentId}
              value={comparison.compareExperimentValue}
              baseExperimentValue={baseExperimentValue}
              color={comparison.compareExperimentColor}
              formatter={formatter}
            />
          ))}
        </Flex>
      </Flex>
    </div>
  );
}

function BaseExperimentMetric({
  value,
  formatter = numberFormatter,
}: {
  value: MetricValue;
  formatter?: (value: MetricValue) => string;
}) {
  const { baseExperimentColor } = useExperimentColors();
  const valueText = formatter(value);
  return (
    <Flex direction="row" alignItems="center" gap="size-100">
      <ColorSwatch color={baseExperimentColor} shape="circle" />
      <Text size="M" fontFamily="mono" weight="heavy">
        {valueText}
      </Text>
    </Flex>
  );
}

function CompareExperimentMetric({
  value,
  baseExperimentValue,
  color,
  formatter = numberFormatter,
}: {
  value: MetricValue;
  baseExperimentValue: MetricValue;
  color: string;
  formatter?: (value: MetricValue) => string;
}) {
  const valueText = useMemo(() => formatter(value), [formatter, value]);
  const percentageDeltaText = useMemo(() => {
    let percentageDeltaText: string = "+0%";
    if (baseExperimentValue == null || value == null) {
      return percentageDeltaText;
    }
    const delta = value - baseExperimentValue;
    const sign = delta >= 0 ? "+" : "-";
    if (baseExperimentValue !== 0) {
      const absolutePercentageDelta =
        Math.abs(delta / baseExperimentValue) * 100;
      percentageDeltaText = `${sign}${percentFormatter(absolutePercentageDelta)}`;
    }
    return percentageDeltaText;
  }, [baseExperimentValue, value]);

  return (
    <Flex direction="row" alignItems="center" gap="size-100">
      <ColorSwatch color={color} shape="circle" />
      <Flex direction="row" alignItems="center" gap="size-50">
        <Text size="M" fontFamily="mono">
          {valueText}
        </Text>
        <Text color="text-500" size="S" fontFamily="mono">
          {percentageDeltaText}
        </Text>
      </Flex>
    </Flex>
  );
}

function ImprovementAndRegressionCounter({
  numImprovements,
  numRegressions,
  numEqual,
}: MetricDelta) {
  const { disableTooltip, tooltipItems } = useMemo(() => {
    const tooltipItems: { key: string; text: string }[] = [];
    if (numImprovements > 0) {
      tooltipItems.push({
        key: "improved",
        text: `${numImprovements} run${numImprovements > 1 ? "s" : ""} improved`,
      });
    }
    if (numRegressions > 0) {
      tooltipItems.push({
        key: "regressed",
        text: `${numRegressions} run${numRegressions > 1 ? "s" : ""} regressed`,
      });
    }
    if (numEqual > 0) {
      tooltipItems.push({
        key: "equal",
        text: `${numEqual} run${numEqual > 1 ? "s" : ""} stayed the same`,
      });
    }
    return { disableTooltip: tooltipItems.length === 0, tooltipItems };
  }, [numEqual, numImprovements, numRegressions]);
  return (
    <TooltipTrigger isDisabled={disableTooltip} delay={200}>
      <TriggerWrap>
        <Flex direction="row" gap="size-100" alignItems="center">
          {numImprovements > 0 && (
            <Flex direction="row" gap="size-75" alignItems="center">
              <Text size="S" fontFamily="mono">
                {numImprovements}
              </Text>
              <Icon
                svg={<Icons.ThumbsUpOutline />}
                color="success"
                css={thumbIconCSS}
              />
            </Flex>
          )}
          {numRegressions > 0 && (
            <Flex direction="row" gap="size-75" alignItems="center">
              <Text size="S" fontFamily="mono">
                {numRegressions}
              </Text>
              <Icon
                svg={<Icons.ThumbsDownOutline />}
                color="danger"
                css={thumbIconCSS}
              />
            </Flex>
          )}
        </Flex>
      </TriggerWrap>
      <Tooltip>
        <ul>
          {tooltipItems.map((tooltipItem) => (
            <li key={tooltipItem.key}>
              <Text key={tooltipItem.key} size="S">
                {tooltipItem.text}
              </Text>
            </li>
          ))}
        </ul>
      </Tooltip>
    </TooltipTrigger>
  );
}

export function HorizontalBarChart({
  bars,
}: {
  bars: {
    value: number;
    color: string;
  }[];
}) {
  if (bars.length === 0) {
    return null;
  }
  const maxValue = Math.max(...bars.map((bar) => bar.value));
  let barLengths: number[] = [];
  if (maxValue !== 0) {
    barLengths = bars.map((bar) => (bar.value / maxValue) * 100);
  } else {
    barLengths = bars.map(() => 0);
  }
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        width: 100%;
      `}
    >
      {bars.map((bar, index) => (
        <div
          key={index}
          css={css`
            background-color: ${bar.color};
            height: 0.3rem;
            border-radius: 2px;
            width: ${barLengths[index]}%;
          `}
        />
      ))}
    </div>
  );
}
