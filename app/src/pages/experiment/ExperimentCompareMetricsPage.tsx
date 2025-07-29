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
              }
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
              }
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
              }
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
              }
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
          <LatencyMetricCard
            baseExperimentLatencyMs={baseExperiment.averageRunLatencyMs}
            compareExperiments={compareExperiments.map((compareExperiment) => {
              return {
                id: compareExperiment.id as string, // fix
                latencyMs: compareExperiment.averageRunLatencyMs,
                numLatencyMsImprovements: 0,
                numLatencyMsRegressions: 1,
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
          <div css={metricCardCSS}>
            <Flex direction="column" gap="size-200">
              <Heading level={2}>Prompt Tokens</Heading>
              <BaseExperimentMetric value={1000} />
              <CompareExperimentMetric
                value={1100}
                baselineValue={1000}
                numImprovements={10}
                numRegressions={5}
              />
              <CompareExperimentMetric
                value={900}
                baselineValue={1000}
                numImprovements={0}
                numRegressions={10}
              />
              <CompareExperimentMetric
                value={1200}
                baselineValue={1000}
                numImprovements={10}
                numRegressions={0}
              />
            </Flex>
          </div>
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          <div css={metricCardCSS}>
            <Flex direction="column" gap="size-200">
              <Heading level={2}>Completion Tokens</Heading>
              <BaseExperimentMetric value={1000} />
              <CompareExperimentMetric
                value={1100}
                baselineValue={1000}
                numImprovements={10}
                numRegressions={5}
              />
              <CompareExperimentMetric
                value={900}
                baselineValue={1000}
                numImprovements={0}
                numRegressions={10}
              />
              <CompareExperimentMetric
                value={1200}
                baselineValue={1000}
                numImprovements={10}
                numRegressions={0}
              />
            </Flex>
          </div>
        </li>
        <li
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          <TotalTokenCountMetricCard
            baseExperimentTotalTokens={baseExperiment.costSummary?.total.tokens}
            compareExperiments={compareExperiments.map((compareExperiments) => {
              return {
                id: compareExperiments.id as string,
                totalTokens: compareExperiments.costSummary?.total.tokens,
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
          <div css={metricCardCSS}>
            <Flex direction="column" gap="size-200">
              <Heading level={2}>Cost</Heading>
              <BaseExperimentMetric value={1000} formatter={costFormatter} />
              <CompareExperimentMetric
                value={1100.01}
                formatter={costFormatter}
                baselineValue={1000}
                numImprovements={10}
                numRegressions={5}
              />
              <CompareExperimentMetric
                value={900}
                formatter={costFormatter}
                baselineValue={1000}
                numImprovements={0}
                numRegressions={10}
              />
              <CompareExperimentMetric
                value={1200}
                formatter={costFormatter}
                baselineValue={1000}
                numImprovements={10}
                numRegressions={0}
              />
            </Flex>
          </div>
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
  baselineValue,
  numImprovements,
  numRegressions,
}: {
  value: number | null | undefined;
  formatter?: (value: number | null | undefined) => string;
  baselineValue: number | null | undefined;
  numImprovements: number;
  numRegressions: number;
}) {
  const valueText = formatter(value);
  let deltaText: string | null = null;
  let percentageDeltaText: string | null = null;
  if (value != null && baselineValue != null) {
    const delta = value - baselineValue;
    const sign = delta >= 0 ? "+" : "-";
    const absoluteDelta = Math.abs(delta);
    deltaText = `(${sign}${formatter(absoluteDelta)})`;
    const absolutePercentageDelta = Math.abs(
      (delta / baselineValue) * 100
    ).toFixed(0);
    percentageDeltaText = `${sign}${absolutePercentageDelta}%`;
  }
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

type LatencyMetricCardProps = {
  baseExperimentLatencyMs: number | null | undefined;
  compareExperiments: {
    id: string;
    latencyMs: number | null | undefined;
    numLatencyMsImprovements: number;
    numLatencyMsRegressions: number;
  }[];
};

function LatencyMetricCard({
  baseExperimentLatencyMs,
  compareExperiments,
}: LatencyMetricCardProps) {
  return (
    <div css={metricCardCSS}>
      <Flex direction="column" gap="size-200">
        <Heading level={2}>Latency</Heading>
        <BaseExperimentMetric
          value={baseExperimentLatencyMs}
          formatter={latencyMsFormatter}
        />
        {compareExperiments.map((compareExperiment) => (
          <CompareExperimentMetric
            key={compareExperiment.id}
            value={compareExperiment.latencyMs}
            formatter={latencyMsFormatter}
            baselineValue={baseExperimentLatencyMs}
            numImprovements={compareExperiment.numLatencyMsImprovements}
            numRegressions={compareExperiment.numLatencyMsRegressions}
          />
        ))}
      </Flex>
    </div>
  );
}

type TotalTokenCountMetricCardProps = {
  baseExperimentTotalTokens: number | null | undefined;
  compareExperiments: {
    id: string;
    totalTokens: number | null | undefined;
    numImprovements: number;
    numRegressions: number;
  }[];
};

function TotalTokenCountMetricCard({
  baseExperimentTotalTokens,
  compareExperiments,
}: TotalTokenCountMetricCardProps) {
  return (
    <div css={metricCardCSS}>
      <Flex direction="column" gap="size-200">
        <Heading level={2}>Total Tokens</Heading>
        <BaseExperimentMetric value={baseExperimentTotalTokens} />
        {compareExperiments.map((compareExperiment) => (
          <CompareExperimentMetric
            key={compareExperiment.id}
            value={compareExperiment.totalTokens}
            baselineValue={baseExperimentTotalTokens}
            numImprovements={compareExperiment.numImprovements}
            numRegressions={compareExperiment.numRegressions}
          />
        ))}
      </Flex>
    </div>
  );
}
