import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { useLoaderData, useSearchParams } from "react-router";
import { css } from "@emotion/react";

import { Flex, Heading, Icon, Icons, Text, View } from "@phoenix/components";
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
  numImprovements: number;
  numRegressions: number;
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
        <Heading level={2}>{title}</Heading>
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
            numImprovements={compareExperiment.numImprovements}
            numRegressions={compareExperiment.numRegressions}
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
                    }
                    completion {
                      tokens
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
          }
          promptTokenCount {
            numIncreases
            numDecreases
          }
          completionTokenCount {
            numIncreases
            numDecreases
          }
          totalTokenCount {
            numIncreases
            numDecreases
          }
          totalCost {
            numIncreases
            numDecreases
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
        }
      }
    `,
    loaderData
  );
  if (!data) {
    throw new Error("Empty state not implemented");
  }

  const metrics = useMemo(() => {
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
    const promptTokensMetric: MetricCardProps = {
      title: "Prompt Tokens",
      baseExperimentValue: baseExperiment.costSummary?.prompt.tokens,
      compareExperiments: [],
    };
    const completionTokensMetric: MetricCardProps = {
      title: "Completion Tokens",
      baseExperimentValue: baseExperiment.costSummary?.completion.tokens,
      compareExperiments: [],
    };
    const totalTokensMetric: MetricCardProps = {
      title: "Total Tokens",
      baseExperimentValue: baseExperiment.costSummary?.total.tokens,
      compareExperiments: [],
    };
    const totalCostMetric: MetricCardProps = {
      title: "Total Cost",
      baseExperimentValue: baseExperiment.costSummary?.total.cost,
      compareExperiments: [],
      formatter: costFormatter,
    };
    compareExperiments.forEach((experiment) => {
      latencyMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.averageRunLatencyMs,
        numImprovements:
          compareExperimentIdToCounts[experiment.id]?.latency.numIncreases ?? 0,
        numRegressions:
          compareExperimentIdToCounts[experiment.id]?.latency.numDecreases ?? 0,
      });
      promptTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary?.prompt?.tokens,
        numImprovements:
          compareExperimentIdToCounts[experiment.id]?.promptTokenCount
            .numIncreases ?? 0,
        numRegressions:
          compareExperimentIdToCounts[experiment.id]?.promptTokenCount
            .numDecreases ?? 0,
      });
      completionTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary?.completion?.tokens,
        numImprovements:
          compareExperimentIdToCounts[experiment.id]?.completionTokenCount
            .numIncreases ?? 0,
        numRegressions:
          compareExperimentIdToCounts[experiment.id]?.completionTokenCount
            .numDecreases ?? 0,
      });
      totalTokensMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary?.total?.tokens,
        numImprovements:
          compareExperimentIdToCounts[experiment.id]?.totalTokenCount
            .numIncreases ?? 0,
        numRegressions:
          compareExperimentIdToCounts[experiment.id]?.totalTokenCount
            .numDecreases ?? 0,
      });
      totalCostMetric.compareExperiments.push({
        experimentId: experiment.id,
        value: experiment.costSummary?.total?.cost,
        numImprovements:
          compareExperimentIdToCounts[experiment.id]?.totalCost.numIncreases ??
          0,
        numRegressions:
          compareExperimentIdToCounts[experiment.id]?.totalCost.numDecreases ??
          0,
      });
    });
    const builtInMetrics = [
      latencyMetric,
      promptTokensMetric,
      completionTokensMetric,
      totalTokensMetric,
      totalCostMetric,
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
      for (const experiment of compareExperiments) {
        const compareExperimentId = experiment.id;
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
        const numImprovements =
          annotationNameToCompareExperimentIdToCounts[annotationName]?.[
            compareExperimentId
          ]?.numIncreases ?? 0;
        const numRegressions =
          annotationNameToCompareExperimentIdToCounts[annotationName]?.[
            compareExperimentId
          ]?.numDecreases ?? 0;
        annotationMetricCompareExperiments.push({
          experimentId: compareExperimentId,
          value: compareExperimentMeanScore,
          numImprovements,
          numRegressions,
        });
      }
      annotationMetrics.push({
        title: annotationName,
        baseExperimentValue: baseExperimentMeanScore,
        compareExperiments: annotationMetricCompareExperiments,
      });
    }
    return [...annotationMetrics, ...builtInMetrics];
  }, [baseExperimentId, compareExperimentIds, data]);

  return (
    <View padding="size-200" width="100%">
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

function BaseExperimentMetric({
  value,
  formatter = numberFormatter,
}: {
  value: MetricValue;
  formatter?: (value: MetricValue) => string;
}) {
  const valueText = formatter(value);
  return <Text size="M">{valueText}</Text>;
}

function CompareExperimentMetric({
  value,
  formatter = numberFormatter,
  baseExperimentValue,
  numImprovements,
  numRegressions,
}: {
  value: MetricValue;
  formatter?: (value: MetricValue) => string;
  baseExperimentValue: MetricValue;
  numImprovements: number;
  numRegressions: number;
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
      <Flex direction="row" alignItems="center" gap="size-50">
        <Text size="M">{valueText}</Text>
        {deltaText && <Text size="S">{deltaText}</Text>}
        {percentageDeltaText && <Text size="S">{percentageDeltaText}</Text>}
      </Flex>
      <ImprovementAndRegressionCounter
        numImprovements={numImprovements}
        numRegressions={numRegressions}
      />
    </Flex>
  );
}

function ImprovementAndRegressionCounter({
  numImprovements,
  numRegressions,
}: {
  numImprovements: number;
  numRegressions: number;
}) {
  return (
    <Flex direction="row" gap="size-50">
      {numImprovements > 0 && (
        <Flex direction="row" alignItems="center">
          <Icon svg={<Icons.ArrowUpwardOutline />} color="green-900" />
          <Text size="M" color="green-900">
            {numImprovements}
          </Text>
        </Flex>
      )}
      {numRegressions > 0 && (
        <Flex direction="row" alignItems="center">
          <Icon svg={<Icons.ArrowDownwardOutline />} color="red-900" />
          <Text size="M" color="red-900">
            {numRegressions}
          </Text>
        </Flex>
      )}
    </Flex>
  );
}
