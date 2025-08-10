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
} from "@phoenix/utils/numberFormatUtils";

import type {
  ExperimentCompareMetricsPage_experiments$data,
  ExperimentCompareMetricsPage_experiments$key,
} from "./__generated__/ExperimentCompareMetricsPage_experiments.graphql";
import type { experimentCompareLoader } from "./experimentCompareLoader";

const metricCardCSS = css`
  padding: var(--ac-global-dimension-size-200);
  border: 1px solid var(--ac-global-color-grey-400);
  background-color: var(--ac-global-color-grey-100);
  box-shadow:
    0 0 1px 0px var(--ac-global-color-grey-400) inset,
    0 0 1px 0px var(--ac-global-color-grey-400);
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
  return (
    <div css={metricCardCSS}>
      <Flex direction="column" gap="size-200">
        <Heading level={3}>{title}</Heading>
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
            color={compareExperiment.color}
          />
        ))}
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
          }
          promptTokenCount {
            numIncreases
            numDecreases
            numEqual
          }
          completionTokenCount {
            numIncreases
            numDecreases
            numEqual
          }
          totalTokenCount {
            numIncreases
            numDecreases
            numEqual
          }
          totalCost {
            numIncreases
            numDecreases
            numEqual
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
      latencyMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.averageRunLatencyMs,
        numIncreases:
          compareExperimentIdToCounts[experiment.id]?.latency.numIncreases ?? 0,
        numDecreases:
          compareExperimentIdToCounts[experiment.id]?.latency.numDecreases ?? 0,
        numEqual:
          compareExperimentIdToCounts[experiment.id]?.latency.numEqual ?? 0,
        color: experimentColor,
      });
      promptTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.prompt.tokens,
        numIncreases:
          compareExperimentIdToCounts[experiment.id]?.promptTokenCount
            .numIncreases ?? 0,
        numDecreases:
          compareExperimentIdToCounts[experiment.id]?.promptTokenCount
            .numDecreases ?? 0,
        numEqual:
          compareExperimentIdToCounts[experiment.id]?.promptTokenCount
            .numEqual ?? 0,
        color: experimentColor,
      });
      completionTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.completion.tokens,
        numIncreases:
          compareExperimentIdToCounts[experiment.id]?.completionTokenCount
            .numIncreases ?? 0,
        numDecreases:
          compareExperimentIdToCounts[experiment.id]?.completionTokenCount
            .numDecreases ?? 0,
        numEqual:
          compareExperimentIdToCounts[experiment.id]?.completionTokenCount
            .numEqual ?? 0,
        color: experimentColor,
      });
      totalTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.total.tokens,
        numIncreases:
          compareExperimentIdToCounts[experiment.id]?.totalTokenCount
            .numIncreases ?? 0,
        numDecreases:
          compareExperimentIdToCounts[experiment.id]?.totalTokenCount
            .numDecreases ?? 0,
        numEqual:
          compareExperimentIdToCounts[experiment.id]?.totalTokenCount
            .numEqual ?? 0,
        color: experimentColor,
      });
      totalCostMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.total.cost,
        numIncreases:
          compareExperimentIdToCounts[experiment.id]?.totalCost.numIncreases ??
          0,
        numDecreases:
          compareExperimentIdToCounts[experiment.id]?.totalCost.numDecreases ??
          0,
        numEqual:
          compareExperimentIdToCounts[experiment.id]?.totalCost.numEqual ?? 0,
        color: experimentColor,
      });
      promptCostMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.prompt.cost,
        numIncreases: 0,
        numDecreases: 0,
        numEqual: 0,
        color: experimentColor,
      });
      completionCostMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary.completion.cost,
        numIncreases: 0,
        numDecreases: 0,
        numEqual: 0,
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
        const numIncreases =
          annotationNameToCompareExperimentIdToCounts[annotationName]?.[
            compareExperimentId
          ]?.numIncreases ?? 0;
        const numDecreases =
          annotationNameToCompareExperimentIdToCounts[annotationName]?.[
            compareExperimentId
          ]?.numDecreases ?? 0;
        const numEqual =
          annotationNameToCompareExperimentIdToCounts[annotationName]?.[
            compareExperimentId
          ]?.numEqual ?? 0;
        annotationMetricCompareExperiments.push({
          experimentId: compareExperimentId,
          value: compareExperimentMeanScore,
          numIncreases,
          numDecreases,
          numEqual,
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
    <Flex direction="row" alignItems="center" gap="size-150">
      <ColorSwatch color={baseExperimentColor} />
      <Text size="L">{valueText}</Text>
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
  color,
}: {
  value: MetricValue;
  formatter?: (value: MetricValue) => string;
  baseExperimentValue: MetricValue;
  numIncreases: number;
  numDecreases: number;
  numEqual: number;
  color: string;
}) {
  const { valueText, deltaText, percentageDeltaText } = useMemo(() => {
    const valueText = formatter(value);
    let deltaText: string | null = null;
    let percentageDeltaText: string | null = null;
    if (value != null && baseExperimentValue != null) {
      const delta = value - baseExperimentValue;
      const sign = delta >= 0 ? "+" : "-";
      const absoluteDelta = Math.abs(delta);
      deltaText = `(${sign}${formatter(absoluteDelta)})`;
      if (baseExperimentValue !== 0) {
        const absolutePercentageDelta = Math.abs(
          (delta / baseExperimentValue) * 100
        ).toFixed(0);
        percentageDeltaText = `${sign}${absolutePercentageDelta}%`;
      }
    }
    return {
      valueText,
      deltaText,
      percentageDeltaText,
    };
  }, [baseExperimentValue, formatter, value]);

  return (
    <Flex direction="row" justifyContent="space-between">
      <Flex direction="row" alignItems="center" gap="size-150">
        <ColorSwatch color={color} />
        <Flex direction="row" alignItems="center" gap="size-115">
          <Text size="L">{valueText}</Text>
          <Flex direction="row" alignItems="center" gap="size-75">
            {deltaText && (
              <Text color="text-500" size="M">
                {deltaText}
              </Text>
            )}
            {percentageDeltaText && (
              <Text color="text-500" size="M">
                {percentageDeltaText}
              </Text>
            )}
          </Flex>
        </Flex>
      </Flex>
      <IncreaseAndDecreaseCounter
        numIncreases={numIncreases}
        numDecreases={numDecreases}
        numEqual={numEqual}
      />
    </Flex>
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
            <Flex direction="row" gap="size-25" alignItems="center">
              <Text size="M">{numIncreases}</Text>

              <Icon svg={<Icons.ArrowUpwardOutline />} color="green-900" />
            </Flex>
          )}
          {numDecreases > 0 && (
            <Flex direction="row" gap="size-25" alignItems="center">
              <Text size="M">{numDecreases}</Text>

              <Icon svg={<Icons.ArrowDownwardOutline />} color="red-900" />
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
