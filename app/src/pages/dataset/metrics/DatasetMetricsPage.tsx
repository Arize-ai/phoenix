import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { ChartPanel } from "@phoenix/components/chart";
import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import { ExperimentsEmpty } from "@phoenix/pages/experiments/ExperimentsEmpty";

import type { DatasetMetricsPageQuery } from "./__generated__/DatasetMetricsPageQuery.graphql";
import { getExperimentMetricChart } from "./chartCatalog";

/**
 * The charts from the chart catalog shown on the metrics tab, row by row.
 */
const METRIC_PAGE_ROWS: ExperimentMetricChartKey[][] = [
  ["latency", "error_rate"],
  ["cost", "tokens"],
];

export function DatasetMetricsPage() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required to view experiment metrics");

  const data = useLazyLoadQuery<DatasetMetricsPageQuery>(
    graphql`
      query DatasetMetricsPageQuery($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experimentCount
          }
        }
      }
    `,
    { datasetId }
  );

  if (!data.dataset?.experimentCount) {
    return <ExperimentsEmpty />;
  }

  return (
    <main
      css={css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow-y: auto;
      `}
    >
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--global-dimension-size-200);
          padding: var(--global-dimension-size-200);
        `}
      >
        {METRIC_PAGE_ROWS.map((row) => (
          <Flex direction="row" gap="size-200" key={row.join("+")}>
            {row.map((chartKey) => {
              const { name, description, Component } =
                getExperimentMetricChart(chartKey);
              return (
                <ChartPanel key={chartKey} title={name} subtitle={description}>
                  <Component datasetId={datasetId} />
                </ChartPanel>
              );
            })}
          </Flex>
        ))}
      </div>
    </main>
  );
}
