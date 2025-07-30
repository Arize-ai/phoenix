import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { useLoaderData } from "react-router";
import { css } from "@emotion/react";

import { Flex, Heading, Icon, Icons, Text, View } from "@phoenix/components";
import {
  costFormatter,
  latencyMsFormatter,
  numberFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type { ExperimentCompareMetricsPage_experiments$key } from "./__generated__/ExperimentCompareMetricsPage_experiments.graphql";
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
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  const data = useFragment<ExperimentCompareMetricsPage_experiments$key>(
    graphql`
      fragment ExperimentCompareMetricsPage_experiments on Query
      @argumentDefinitions(
        baseExperimentId: { type: "ID!" }
        firstCompareExperimentId: { type: "ID!" }
        secondCompareExperimentId: { type: "ID!" }
        thirdCompareExperimentId: { type: "ID!" }
        hasFirstCompareExperiment: { type: "Boolean!" }
        hasSecondCompareExperiment: { type: "Boolean!" }
        hasThirdCompareExperiment: { type: "Boolean!" }
      ) {
        baseExperiment: node(id: $baseExperimentId) {
          ... on Experiment {
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
        firstCompareExperiment: node(id: $firstCompareExperimentId)
          @include(if: $hasFirstCompareExperiment) {
          ... on Experiment {
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
        secondCompareExperiment: node(id: $secondCompareExperimentId)
          @include(if: $hasSecondCompareExperiment) {
          ... on Experiment {
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
        thirdCompareExperiment: node(id: $thirdCompareExperimentId)
          @include(if: $hasThirdCompareExperiment) {
          ... on Experiment {
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
    `,
    loaderData
  );
  if (!data) {
    throw new Error("Empty state not implemented");
  }
  const { baseExperiment, compareExperiments } = useMemo(() => {
    const baseExperiment = data.baseExperiment;
    const compareExperiments = [];
    if (data.firstCompareExperiment) {
      compareExperiments.push(data.firstCompareExperiment);
    }
    if (data.secondCompareExperiment) {
      compareExperiments.push(data.secondCompareExperiment);
    }
    if (data.thirdCompareExperiment) {
      compareExperiments.push(data.thirdCompareExperiment);
    }
    return {
      baseExperiment,
      compareExperiments,
    };
  }, [
    data.baseExperiment,
    data.firstCompareExperiment,
    data.secondCompareExperiment,
    data.thirdCompareExperiment,
  ]);
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
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          <MetricCard
            title="Latency"
            baseExperimentValue={baseExperiment.averageRunLatencyMs}
            compareExperiments={compareExperiments.map((compareExperiment) => {
              return {
                experimentId: compareExperiment.id as string,
                value: compareExperiment.averageRunLatencyMs,
                numImprovements: 0,
                numRegressions: 1,
              };
            })}
            formatter={latencyMsFormatter}
          />
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          <MetricCard
            title="Prompt Tokens"
            baseExperimentValue={baseExperiment.costSummary?.prompt.tokens}
            compareExperiments={compareExperiments.map((compareExperiments) => {
              return {
                experimentId: compareExperiments.id as string,
                value: compareExperiments.costSummary?.prompt.tokens,
                numImprovements: 10,
                numRegressions: 5,
              };
            })}
          />
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          <MetricCard
            title="Completion Tokens"
            baseExperimentValue={baseExperiment.costSummary?.completion.tokens}
            compareExperiments={compareExperiments.map((compareExperiments) => {
              return {
                experimentId: compareExperiments.id as string,
                value: compareExperiments.costSummary?.completion.tokens,
                numImprovements: 10,
                numRegressions: 5,
              };
            })}
          />
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          <MetricCard
            title="Total Tokens"
            baseExperimentValue={baseExperiment.costSummary?.total.tokens}
            compareExperiments={compareExperiments.map((compareExperiments) => {
              return {
                experimentId: compareExperiments.id as string,
                value: compareExperiments.costSummary?.total.tokens,
                numImprovements: 10,
                numRegressions: 5,
              };
            })}
          />
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          <MetricCard
            title="Total Cost"
            baseExperimentValue={baseExperiment.costSummary?.total.cost}
            compareExperiments={compareExperiments.map((compareExperiments) => {
              return {
                experimentId: compareExperiments.id as string,
                value: compareExperiments.costSummary?.total.cost,
                numImprovements: 10,
                numRegressions: 5,
              };
            })}
            formatter={costFormatter}
          />
        </li>
      </ul>
    </View>
  );
}

function BaseExperimentMetric({
  value,
  formatter = numberFormatter,
}: {
  value: number | null | undefined;
  formatter?: (value: number | null | undefined) => string;
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
  value: number | null | undefined;
  formatter?: (value: number | null | undefined) => string;
  baseExperimentValue: number | null | undefined;
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
