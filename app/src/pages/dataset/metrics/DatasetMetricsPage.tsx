import { css } from "@emotion/react";
import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { ChartPanel } from "@phoenix/components/chart";
import type { ExperimentMetricChartKey } from "@phoenix/pages/dataset/constants";
import { ExperimentsEmpty } from "@phoenix/pages/experiments/ExperimentsEmpty";

import { getExperimentMetricChart } from "./chartCatalog";
import { useExperimentMetricsData } from "./useExperimentMetricsData";

/**
 * The charts from the chart catalog shown on the metrics tab, row by row.
 * This layout, not the catalog key order, determines the display order.
 */
const METRIC_PAGE_ROWS: ExperimentMetricChartKey[][] = [
  ["annotation_scores"],
  ["latency", "error_rate"],
  ["cost", "tokens"],
];

export function DatasetMetricsPage() {
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required to view experiment metrics");

  // The same query the charts read from — they resolve from the Relay store,
  // so the page and all charts share a single network request
  const { experiments } = useExperimentMetricsData(datasetId);

  if (experiments.length === 0) {
    return <ExperimentsEmpty />;
  }

  return (
    <section
      aria-label="Experiment metrics"
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
    </section>
  );
}
