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
import { HorizontalBarChart } from "@phoenix/components/HorizontalBarChart";
import {
  costFormatter,
  latencyMsFormatter,
  numberFormatter,
  percentFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type {
  ExperimentCompareMetricsPage_experiments$data,
  ExperimentCompareMetricsPage_experiments$key,
  OptimizationDirection,
} from "./__generated__/ExperimentCompareMetricsPage_experiments.graphql";
import type { experimentCompareLoader } from "./experimentCompareLoader";

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

type CompareExperimentData = {
  experimentId: string;
  value: MetricValue;
  numIncreases: number;
  numDecreases: number;
  numEqual: number;
  optimizationDirection: OptimizationDirection;
  color: string;
};

type MetricCardProps = {
  title: string;
  baseExperimentValue: MetricValue;
  compareExperiments: CompareExperimentData[];
  formatter?: (value: MetricValue) => string;
};

type Experiment = NonNullable<
  ExperimentCompareMetricsPage_experiments$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type CompareExperimentRunMetricCounts =
  ExperimentCompareMetricsPage_experiments$data["compareExperimentRunMetricCounts"][number];

type CompareExperimentRunAnnotationMetricCounts =
  ExperimentCompareMetricsPage_experiments$data["compareExperimentRunAnnotationMetricCounts"][number];

function MetricCard({
  title,
  baseExperimentValue,
  compareExperiments,
  formatter = numberFormatter,
}: MetricCardProps) {
  const { baseExperimentColor } = useExperimentColors();
  return (
    <div css={metricCardCSS}>
      <Flex direction="column" gap="size-200">
        <Heading level={3}>{title}</Heading>
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
          {compareExperiments.map((compareExperiment) => (
            <CompareExperimentMetric
              key={compareExperiment.experimentId}
              value={compareExperiment.value}
              formatter={formatter}
              baseExperimentValue={baseExperimentValue}
              numIncreases={compareExperiment.numIncreases}
              numDecreases={compareExperiment.numDecreases}
              numEqual={compareExperiment.numEqual}
              optimizationDirection={compareExperiment.optimizationDirection}
              color={compareExperiment.color}
            />
          ))}
        </Flex>
      </Flex>
    </div>
  );
}

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
        compareExperimentRunMetricCounts(
          baseExperimentId: $baseExperimentId
          compareExperimentIds: $compareExperimentIds
        ) {
          compareExperimentId
          latency {
            numIncreases
            numDecreases
            numEqual
            optimizationDirection
          }
          totalTokenCount {
            numIncreases
            numDecreases
            numEqual
            optimizationDirection
          }
          promptTokenCount {
            numIncreases
            numDecreases
            numEqual
            optimizationDirection
          }
          completionTokenCount {
            numIncreases
            numDecreases
            numEqual
            optimizationDirection
          }
          totalCost {
            numIncreases
            numDecreases
            numEqual
            optimizationDirection
          }
          promptCost {
            numIncreases
            numDecreases
            numEqual
            optimizationDirection
          }
          completionCost {
            numIncreases
            numDecreases
            numEqual
            optimizationDirection
          }
        }
        compareExperimentRunAnnotationMetricCounts(
          baseExperimentId: $baseExperimentId
          compareExperimentIds: $compareExperimentIds
        ) {
          annotationName
          compareExperimentId
          numIncreases
          numDecreases
          numEqual
          optimizationDirection
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

    const compareExperimentIdToCounts: Record<
      string,
      CompareExperimentRunMetricCounts
    > = {};
    data.compareExperimentRunMetricCounts.map((counts) => {
      compareExperimentIdToCounts[counts.compareExperimentId] = counts;
    });

    const annotationNameToCompareExperimentIdToCounts: Record<
      string,
      Record<string, CompareExperimentRunAnnotationMetricCounts>
    > = {};
    data.compareExperimentRunAnnotationMetricCounts.forEach((counts) => {
      const compareExperimentId = counts.compareExperimentId;
      const annotationName = counts.annotationName;
      if (!(annotationName in annotationNameToCompareExperimentIdToCounts)) {
        annotationNameToCompareExperimentIdToCounts[annotationName] = {};
      }
      annotationNameToCompareExperimentIdToCounts[annotationName][
        compareExperimentId
      ] = counts;
    });

    const latencyMetric: MetricCardProps = {
      title: "Latency",
      baseExperimentValue: baseExperiment.averageRunLatencyMs,
      compareExperiments: [],
      formatter: latencyMsFormatter,
    };
    const totalTokensMetric: MetricCardProps = {
      title: "Total Tokens",
      baseExperimentValue: baseExperiment.costSummary.total.tokens,
      compareExperiments: [],
    };
    const promptTokensMetric: MetricCardProps = {
      title: "Prompt Tokens",
      baseExperimentValue: baseExperiment.costSummary.prompt.tokens,
      compareExperiments: [],
    };
    const completionTokensMetric: MetricCardProps = {
      title: "Completion Tokens",
      baseExperimentValue: baseExperiment.costSummary.completion.tokens,
      compareExperiments: [],
    };
    const totalCostMetric: MetricCardProps = {
      title: "Total Cost",
      baseExperimentValue: baseExperiment.costSummary.total.cost,
      compareExperiments: [],
      formatter: costFormatter,
    };
    const promptCostMetric: MetricCardProps = {
      title: "Prompt Cost",
      baseExperimentValue: baseExperiment.costSummary.prompt.cost,
      compareExperiments: [],
      formatter: costFormatter,
    };
    const completionCostMetric: MetricCardProps = {
      title: "Completion Cost",
      baseExperimentValue: baseExperiment.costSummary.completion.cost,
      compareExperiments: [],
      formatter: costFormatter,
    };
    compareExperiments.forEach((experiment, experimentIndex) => {
      const experimentColor = getExperimentColor(experimentIndex);
      const counts = compareExperimentIdToCounts[experiment.id];
      latencyMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.averageRunLatencyMs,
        numIncreases: counts.latency.numIncreases,
        numDecreases: counts.latency.numDecreases,
        numEqual: counts.latency.numEqual,
        optimizationDirection: counts.latency.optimizationDirection,
        color: experimentColor,
      });
      promptTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.prompt.tokens,
        numIncreases: counts.promptTokenCount.numIncreases,
        numDecreases: counts.promptTokenCount.numDecreases,
        numEqual: counts.promptTokenCount.numEqual,
        optimizationDirection: counts.promptTokenCount.optimizationDirection,
        color: experimentColor,
      });
      completionTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.completion.tokens,
        numIncreases: counts.completionTokenCount.numIncreases,
        numDecreases: counts.completionTokenCount.numDecreases,
        numEqual: counts.completionTokenCount.numEqual,
        optimizationDirection:
          counts.completionTokenCount.optimizationDirection,
        color: experimentColor,
      });
      totalTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.total.tokens,
        numIncreases: counts.totalTokenCount.numIncreases,
        numDecreases: counts.totalTokenCount.numDecreases,
        numEqual: counts.totalTokenCount.numEqual,
        optimizationDirection: counts.totalTokenCount.optimizationDirection,
        color: experimentColor,
      });
      totalCostMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.total.cost,
        numIncreases: counts.totalCost.numIncreases,
        numDecreases: counts.totalCost.numDecreases,
        numEqual: counts.totalCost.numEqual,

        optimizationDirection: counts.totalCost.optimizationDirection,
        color: experimentColor,
      });
      promptCostMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.prompt.cost,
        numIncreases: counts.promptCost.numIncreases,
        numDecreases: counts.promptCost.numDecreases,
        numEqual: counts.promptCost.numEqual,

        optimizationDirection: counts.promptCost.optimizationDirection,
        color: experimentColor,
      });
      completionCostMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.completion.cost,
        numIncreases: counts.completionCost.numIncreases,
        numDecreases: counts.completionCost.numDecreases,
        numEqual: counts.completionCost.numEqual,
        optimizationDirection: counts.completionCost.optimizationDirection,
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
      const annotationMetricCompareExperiments: CompareExperimentData[] = [];
      compareExperiments.forEach((experiment, experimentIndex) => {
        const compareExperimentId = experiment.id;
        const experimentColor = getExperimentColor(experimentIndex);
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
        const annotationCounts =
          annotationNameToCompareExperimentIdToCounts[annotationName][
            compareExperimentId
          ];
        const numIncreases = annotationCounts.numIncreases;
        const numDecreases = annotationCounts.numDecreases;
        const numEqual = annotationCounts.numEqual;
        annotationMetricCompareExperiments.push({
          experimentId: compareExperimentId,
          value: compareExperimentMeanScore,
          numIncreases,
          numDecreases,
          numEqual,
          optimizationDirection: annotationCounts.optimizationDirection,
          color: experimentColor,
        });
      });
      annotationMetrics.push({
        title: annotationName,
        baseExperimentValue: baseExperimentMeanScore,
        compareExperiments: annotationMetricCompareExperiments,
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
        min-width: 1280px;
      `}
    >
      <View padding="size-200">
        <Flex direction="row" gap="size-250">
          {annotationMetrics.length > 0 && (
            <View>
              <Heading
                level={2}
                css={css`
                  margin-bottom: var(--ac-global-dimension-size-150);
                `}
              >
                Evaluations
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
                {annotationMetrics.map((metric: MetricCardProps) => (
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
          )}
          <View>
            <Heading
              level={2}
              css={css`
                margin-bottom: var(--ac-global-dimension-size-150);
              `}
            >
              Cost
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
              {costMetrics.map((metric: MetricCardProps) => (
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
          <View>
            <Heading
              level={2}
              css={css`
                margin-bottom: var(--ac-global-dimension-size-150);
              `}
            >
              Performance
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
              {performanceMetrics.map((metric: MetricCardProps) => (
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
          <View>
            <Heading
              level={2}
              css={css`
                margin-bottom: var(--ac-global-dimension-size-150);
              `}
            >
              Token Counts
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
              {tokenCountMetrics.map((metric: MetricCardProps) => (
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
        </Flex>
      </View>
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
  formatter = numberFormatter,
  baseExperimentValue,
  numIncreases,
  numDecreases,
  numEqual,
  optimizationDirection,
  color,
}: {
  value: MetricValue;
  formatter?: (value: MetricValue) => string;
  baseExperimentValue: MetricValue;
  numIncreases: number;
  numDecreases: number;
  numEqual: number;
  optimizationDirection: OptimizationDirection;
  color: string;
}) {
  const valueText = useMemo(() => formatter(value), [formatter, value]);

  return (
    <Flex direction="row" justifyContent="space-between">
      <Flex direction="row" alignItems="center" gap="size-100">
        <ColorSwatch color={color} shape="circle" />
        <Flex direction="row" alignItems="center" gap="size-50">
          <Text size="M" fontFamily="mono">
            {valueText}
          </Text>
          <PercentageDelta
            baseExperimentValue={baseExperimentValue}
            compareExperimentValue={value}
          />
        </Flex>
      </Flex>
      <ChangeCounter
        numIncreases={numIncreases}
        numDecreases={numDecreases}
        numEqual={numEqual}
        optimizationDirection={optimizationDirection}
      />
    </Flex>
  );
}

function ChangeCounter({
  numIncreases,
  numDecreases,
  numEqual,
  optimizationDirection,
}: {
  numIncreases: number;
  numDecreases: number;
  numEqual: number;
  optimizationDirection: OptimizationDirection;
}) {
  if (optimizationDirection === "NONE") {
    return (
      <IncreaseAndDecreaseCounter
        numIncreases={numIncreases}
        numDecreases={numDecreases}
        numEqual={numEqual}
      />
    );
  }
  return (
    <ImprovementAndRegressionCounter
      numIncreases={numIncreases}
      numDecreases={numDecreases}
      numEqual={numEqual}
      optimizationDirection={optimizationDirection}
    />
  );
}

function ImprovementAndRegressionCounter({
  numIncreases,
  numDecreases,
  numEqual,
  optimizationDirection,
}: {
  numIncreases: number;
  numDecreases: number;
  numEqual: number;
  optimizationDirection: OptimizationDirection;
}) {
  let numImprovements: number;
  let numRegressions: number;
  if (optimizationDirection === "MAXIMIZE") {
    numImprovements = numIncreases;
    numRegressions = numDecreases;
  } else if (optimizationDirection === "MINIMIZE") {
    numImprovements = numDecreases;
    numRegressions = numIncreases;
  } else {
    throw new Error(
      `Cannot compute improvement and regression counts for optimization direction: ${optimizationDirection}`
    );
  }
  const { disableTooltip, tooltipTexts } = useMemo(() => {
    const tooltipTexts: string[] = [];
    if (numImprovements > 0) {
      tooltipTexts.push(
        `${numImprovements} example${numImprovements > 1 ? "s" : ""} improved`
      );
    }
    if (numRegressions > 0) {
      tooltipTexts.push(
        `${numRegressions} example${numRegressions > 1 ? "s" : ""} regressed`
      );
    }
    if (numEqual > 0) {
      tooltipTexts.push(
        `${numEqual} example${numEqual > 1 ? "s" : ""} stayed the same`
      );
    }
    return { disableTooltip: tooltipTexts.length === 0, tooltipTexts };
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
        <Flex direction="column" gap="size-50">
          {tooltipTexts.map((tooltipText) => (
            <Text key={tooltipText}>{tooltipText}</Text>
          ))}
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}

function IncreaseAndDecreaseCounter({
  numIncreases,
  numDecreases,
  numEqual,
}: {
  numIncreases: number;
  numDecreases: number;
  numEqual: number;
}) {
  const { disableTooltip, tooltipTexts } = useMemo(() => {
    const tooltipTexts: string[] = [];
    if (numIncreases > 0) {
      tooltipTexts.push(
        `${numIncreases} example${numIncreases > 1 ? "s" : ""} increased`
      );
    }
    if (numDecreases > 0) {
      tooltipTexts.push(
        `${numDecreases} example${numDecreases > 1 ? "s" : ""} decreased`
      );
    }
    if (numEqual > 0) {
      tooltipTexts.push(
        `${numEqual} example${numEqual > 1 ? "s" : ""} stayed the same`
      );
    }
    return { disableTooltip: tooltipTexts.length === 0, tooltipTexts };
  }, [numDecreases, numEqual, numIncreases]);
  return (
    <TooltipTrigger isDisabled={disableTooltip} delay={200}>
      <TriggerWrap>
        <Flex direction="row" gap="size-100">
          {numIncreases > 0 && (
            <Flex direction="row" alignItems="center">
              <Text size="S" fontFamily="mono">
                {numIncreases}
              </Text>
              <Icon
                svg={<Icons.ArrowDiagonalUpRightOutline />}
                color="grey-500"
              />
            </Flex>
          )}
          {numDecreases > 0 && (
            <Flex direction="row" alignItems="center">
              <Text size="S" fontFamily="mono">
                {numDecreases}
              </Text>
              <Icon
                svg={<Icons.ArrowDiagonalDownRightOutline />}
                color="grey-500"
              />
            </Flex>
          )}
        </Flex>
      </TriggerWrap>
      <Tooltip>
        <Flex direction="column" gap="size-50">
          {tooltipTexts.map((tooltipText) => (
            <Text key={tooltipText}>{tooltipText}</Text>
          ))}
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}

function PercentageDelta({
  baseExperimentValue,
  compareExperimentValue,
}: {
  baseExperimentValue: MetricValue;
  compareExperimentValue: MetricValue;
}) {
  const { percentageDeltaText, sign } = useMemo(() => {
    let percentageDeltaText: string = "+0%";
    let sign: "positive" | "negative" | "zero" = "zero";
    if (baseExperimentValue == null || compareExperimentValue == null) {
      return {
        percentageDeltaText,
        sign,
      };
    }
    const delta = baseExperimentValue - compareExperimentValue;
    if (delta > 0) {
      sign = "positive";
    } else if (delta < 0) {
      sign = "negative";
    }
    const signSymbol = sign === "positive" || sign === "zero" ? "+" : "-";
    if (compareExperimentValue !== 0) {
      const absolutePercentageDelta =
        Math.abs(delta / compareExperimentValue) * 100;
      percentageDeltaText = `${signSymbol}${percentFormatter(absolutePercentageDelta)}`;
    }
    return {
      percentageDeltaText,
      sign,
    };
  }, [baseExperimentValue, compareExperimentValue]);
  return (
    <Flex direction="row" alignItems="center" gap="size-25">
      <Text color="grey-500" size="S" fontFamily="mono">
        {percentageDeltaText}
      </Text>
      {sign === "positive" && (
        <Icon svg={<Icons.TrendingUpOutline />} color="grey-500" />
      )}
      {sign === "negative" && (
        <Icon svg={<Icons.TrendingDownOutline />} color="grey-500" />
      )}
    </Flex>
  );
}
