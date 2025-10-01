import { ReactNode, useMemo } from "react";
import {
  graphql,
  PreloadedQuery,
  useFragment,
  usePreloadedQuery,
} from "react-relay";
import { useSearchParams } from "react-router";
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
import { ColorSwatch } from "@phoenix/components/color/ColorSwatch";
import { useExperimentColors } from "@phoenix/components/experiment";
import { useTheme } from "@phoenix/contexts";
import { ExperimentComparePageQueriesCompareMetricsQuery } from "@phoenix/pages/experiment/ExperimentComparePageQueries";
import { getWordColor } from "@phoenix/utils/colorUtils";
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
import type { ExperimentComparePageQueriesCompareMetricsQuery as ExperimentComparePageQueriesCompareMetricsQueryType } from "./__generated__/ExperimentComparePageQueriesCompareMetricsQuery.graphql";

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

type CompareExperiment = {
  id: string;
  value: MetricValue;
  color: string;
};

type Experiment = NonNullable<
  ExperimentCompareMetricsPage_experiments$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

export function ExperimentCompareMetricsPage({
  queryRef,
}: {
  queryRef: PreloadedQuery<ExperimentComparePageQueriesCompareMetricsQueryType>;
}) {
  const [searchParams] = useSearchParams();
  const [baseExperimentId = undefined, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  if (baseExperimentId == null) {
    throw new Error("Empty state not yet implemented");
  }
  const { getExperimentColor } = useExperimentColors();
  const preloadedData =
    usePreloadedQuery<ExperimentComparePageQueriesCompareMetricsQueryType>(
      ExperimentComparePageQueriesCompareMetricsQuery,
      queryRef
    );
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
    preloadedData
  );
  if (!data) {
    throw new Error("Empty state not implemented");
  }

  const { theme } = useTheme();
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
    if (!baseExperiment) {
      return {
        annotationMetrics: [],
        costMetrics: [],
        performanceMetrics: [],
        tokenCountMetrics: [],
      };
    }
    const compareExperiments = compareExperimentIds
      .map((experimentId) => {
        return experimentIdToExperiment[experimentId];
      })
      // if a new experiment was just added, data may not be fully loaded yet
      .filter((experiment) => experiment != null);

    const comparisons = data.experimentRunMetricComparisons;
    const latencyMetric: MetricCardProps = {
      icon: <Icon svg={<Icons.ClockOutline />} />,
      title: "Latency",
      baseExperimentValue: baseExperiment.averageRunLatencyMs,
      comparison: {
        numImprovements: comparisons?.latency.numRunsImproved ?? 0,
        numRegressions: comparisons?.latency.numRunsRegressed ?? 0,
        numEqual: comparisons?.latency.numRunsEqual ?? 0,
        optimizationDirection: "MAXIMIZE",
      },
      compareExperiments: [],
      formatter: latencyMsFormatter,
    };
    const totalTokensMetric: MetricCardProps = {
      icon: <Icon svg={<Icons.TokensOutline />} />,
      title: "Total Tokens",
      baseExperimentValue: baseExperiment.costSummary.total.tokens,
      comparison: {
        numImprovements: comparisons?.totalTokenCount.numRunsImproved ?? 0,
        numRegressions: comparisons?.totalTokenCount.numRunsRegressed ?? 0,
        numEqual: comparisons?.totalTokenCount.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      compareExperiments: [],
    };
    const promptTokensMetric: MetricCardProps = {
      icon: <Icon svg={<Icons.TokensOutline />} />,
      title: "Prompt Tokens",
      baseExperimentValue: baseExperiment.costSummary.prompt.tokens,
      comparison: {
        numImprovements: comparisons?.promptTokenCount.numRunsImproved ?? 0,
        numRegressions: comparisons?.promptTokenCount.numRunsRegressed ?? 0,
        numEqual: comparisons?.promptTokenCount.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      compareExperiments: [],
    };
    const completionTokensMetric: MetricCardProps = {
      icon: <Icon svg={<Icons.TokensOutline />} />,
      title: "Completion Tokens",
      baseExperimentValue: baseExperiment.costSummary.completion.tokens,
      comparison: {
        numImprovements: comparisons?.completionTokenCount.numRunsImproved ?? 0,
        numRegressions: comparisons?.completionTokenCount.numRunsRegressed ?? 0,
        numEqual: comparisons?.completionTokenCount.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      compareExperiments: [],
    };
    const totalCostMetric: MetricCardProps = {
      icon: <Icon svg={<Icons.PriceTagsOutline />} />,
      title: "Total Cost",
      baseExperimentValue: baseExperiment.costSummary.total.cost,
      comparison: {
        numImprovements: comparisons?.totalCost.numRunsImproved ?? 0,
        numRegressions: comparisons?.totalCost.numRunsRegressed ?? 0,
        numEqual: comparisons?.totalCost.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      compareExperiments: [],
      formatter: costFormatter,
    };
    const promptCostMetric: MetricCardProps = {
      icon: <Icon svg={<Icons.PriceTagsOutline />} />,
      title: "Prompt Cost",
      baseExperimentValue: baseExperiment.costSummary.prompt.cost,
      comparison: {
        numImprovements: comparisons?.promptCost.numRunsImproved ?? 0,
        numRegressions: comparisons?.promptCost.numRunsRegressed ?? 0,
        numEqual: comparisons?.promptCost.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      compareExperiments: [],
      formatter: costFormatter,
    };
    const completionCostMetric: MetricCardProps = {
      icon: <Icon svg={<Icons.PriceTagsOutline />} />,
      title: "Completion Cost",
      baseExperimentValue: baseExperiment.costSummary.completion.cost,
      comparison: {
        numImprovements: comparisons?.completionCost.numRunsImproved ?? 0,
        numRegressions: comparisons?.completionCost.numRunsRegressed ?? 0,
        numEqual: comparisons?.completionCost.numRunsEqual ?? 0,
        optimizationDirection: "MINIMIZE",
      },
      compareExperiments: [],
      formatter: costFormatter,
    };
    compareExperiments.forEach((experiment, experimentIndex) => {
      const experimentColor = getExperimentColor(experimentIndex);
      latencyMetric.compareExperiments.push({
        id: experiment.id,
        value: experiment.averageRunLatencyMs,
        color: experimentColor,
      });
      promptTokensMetric.compareExperiments.push({
        id: experiment.id,
        value: experiment.costSummary.prompt.tokens,
        color: experimentColor,
      });
      completionTokensMetric.compareExperiments.push({
        id: experiment.id,
        value: experiment.costSummary.completion.tokens,
        color: experimentColor,
      });
      totalTokensMetric.compareExperiments.push({
        id: experiment.id,
        value: experiment.costSummary.total.tokens,
        color: experimentColor,
      });
      totalCostMetric.compareExperiments.push({
        id: experiment.id,
        value: experiment.costSummary.total.cost,
        color: experimentColor,
      });
      promptCostMetric.compareExperiments.push({
        id: experiment.id,
        value: experiment.costSummary.prompt.cost,
        color: experimentColor,
      });
      completionCostMetric.compareExperiments.push({
        id: experiment.id,
        value: experiment.costSummary.completion.cost,
        color: experimentColor,
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
      const annotationMetricComparisons: CompareExperiment[] = [];
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
          id: compareExperimentId,
          value: compareExperimentMeanScore,
          color: compareExperimentColor,
        });
      });
      annotationMetrics.push({
        icon: (
          <ColorSwatch color={getWordColor({ word: annotationName, theme })} />
        ),
        title: annotationName,
        baseExperimentValue: baseExperimentMeanScore,
        compareExperiments: annotationMetricComparisons,
      });
    }
    return {
      annotationMetrics,
      costMetrics,
      performanceMetrics,
      tokenCountMetrics,
    };
  }, [baseExperimentId, compareExperimentIds, data, getExperimentColor, theme]);

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
          display: flex;
          flex-direction: column;
          gap: var(--ac-global-dimension-size-200);
          min-width: 300px;
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

type ExperimentRunMetricComparison = {
  numImprovements: number;
  numRegressions: number;
  numEqual: number;
  optimizationDirection: OptimizationDirection;
};

type MetricCardProps = {
  icon: ReactNode;
  title: string;
  baseExperimentValue: MetricValue;
  compareExperiments: CompareExperiment[];
  formatter?: (value: MetricValue) => string;
  comparison?: ExperimentRunMetricComparison;
};

function MetricCard({
  icon,
  title,
  baseExperimentValue,
  comparison,
  compareExperiments,
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
          <Flex direction="row" alignItems="center" gap="size-100">
            {icon}
            <Heading level={3}>{title}</Heading>
          </Flex>
          {comparison && <ImprovementAndRegressionCounter {...comparison} />}
        </Flex>
        <HorizontalBarChart
          bars={[
            {
              value: baseExperimentValue ?? 0,
              color: baseExperimentColor,
            },
            ...compareExperiments.map((experiment) => ({
              value: experiment.value ?? 0,
              color: experiment.color,
            })),
          ]}
        />
        <Flex direction="column">
          <BaseExperimentMetric
            value={baseExperimentValue}
            formatter={formatter}
          />
          {compareExperiments.map((experiment) => (
            <CompareExperimentMetric
              key={experiment.id}
              value={experiment.value}
              baseExperimentValue={baseExperimentValue}
              color={experiment.color}
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
}: ExperimentRunMetricComparison) {
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
/**
 * A small horizontal bar chart that shows the relative values of a metric
 */
function HorizontalBarChart({
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
